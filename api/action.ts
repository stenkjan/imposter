import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createGame,
  isLastRound,
  makeRound,
  reduce,
  MIN_PLAYERS,
  type GameState,
} from '../src/game/state.js'
import { isValidCode, type ClientAction } from '../src/online/protocol.js'
import * as kv from './_lib/kv.js'
import {
  authorize,
  clampSettings,
  fail,
  keysFor,
  loadRoom,
  saveRoom,
  touchPresence,
  versionKey,
  viewFor,
  type Room,
} from './_lib/room.js'

/**
 * Every change to a room goes through here. Two rules keep it honest:
 * a player may only speak for themselves, and only the host paces the table.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!kv.kvConfigured) return fail(res, 503, 'storage-unconfigured')
  if (req.method !== 'POST') return fail(res, 405, 'method-not-allowed')

  const body = (req.body ?? {}) as Record<string, unknown>
  const code = String(body.code ?? '').toUpperCase()
  const playerId = String(body.playerId ?? '')
  const token = String(body.token ?? '')
  const action = body.action as ClientAction | undefined

  if (!isValidCode(code)) return fail(res, 400, 'bad-code')
  if (!action?.type) return fail(res, 400, 'no-action')

  const room = await loadRoom(code)
  if (!room) return fail(res, 404, 'no-such-room')
  if (!authorize(room, playerId, token)) return fail(res, 403, 'not-a-member')

  const isHost = room.hostId === playerId
  await touchPresence(code, playerId)

  try {
    const changed = await apply(room, playerId, isHost, action)
    const version = changed
      ? await saveRoom(room)
      : Number((await kv.get(versionKey(code))) ?? 0)
    return res.status(200).json(await viewFor(room, playerId, version))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed'
    return fail(res, 400, message)
  }
}

/** Mutates `room` in place; returns whether the room document itself changed. */
async function apply(
  room: Room,
  playerId: string,
  isHost: boolean,
  action: ClientAction,
): Promise<boolean> {
  const game = room.game

  switch (action.type) {
    case 'ready': {
      if (!game || game.phase !== 'reveal') return false
      const key = keysFor.readyKey(room.code, game.round.index)
      await kv.sadd(key, playerId)
      await kv.expire(key, 6 * 60 * 60)
      const ready = await kv.smembers(key)
      if (ready.length < room.players.length) {
        // Nothing in the room document changed, but the watchers want to
        // see the tick appear next to the name.
        await kv.incr(versionKey(room.code))
        return false
      }
      let next: GameState = game
      while (next.phase === 'reveal') next = reduce(next, { type: 'revealNext' })
      room.game = next
      return true
    }

    case 'vote': {
      if (!game || game.phase !== 'vote') return false
      if (!game.round.alive.includes(playerId)) throw new Error('not-alive')
      const target = action.targetId
      if (target && !game.round.alive.includes(target)) throw new Error('bad-target')

      const key = keysFor.voteKey(room.code, game.round.index, game.round.pass)
      await kv.hset(key, playerId, target ?? '')
      await kv.expire(key, 6 * 60 * 60)
      const votes = await kv.hgetall(key)

      const outstanding = game.round.alive.filter((id) => !(id in votes))
      if (outstanding.length > 0) {
        await kv.incr(versionKey(room.code))
        return false
      }
      // Whoever completes the vote resolves it — but only once.
      const lock = keysFor.lockKey(room.code, `tally:${game.round.index}:${game.round.pass}`)
      if (!(await kv.claim(lock, 15))) return false
      room.game = reduce(game, { type: 'eject', playerId: tally(votes) })
      return true
    }

    // ------------------------------------------------------------ host only

    case 'settings':
      requireHost(isHost)
      if (game) throw new Error('already-started')
      room.settings = clampSettings(action.settings, room.players.length)
      return true

    case 'lang':
      requireHost(isHost)
      room.lang = action.lang === 'en' ? 'en' : 'de'
      return true

    case 'kick': {
      requireHost(isHost)
      if (game) throw new Error('already-started')
      if (action.playerId === room.hostId) throw new Error('cannot-kick-host')
      room.players = room.players.filter((p) => p.id !== action.playerId)
      delete room.secrets[action.playerId]
      return true
    }

    case 'start':
      requireHost(isHost)
      if (game) throw new Error('already-started')
      if (room.players.length < MIN_PLAYERS) throw new Error('need-more-players')
      room.settings = clampSettings(room.settings, room.players.length)
      room.game = createGame(room.players, room.settings)
      return true

    case 'toVote':
      requireHost(isHost)
      if (!game || game.phase !== 'discuss') return false
      room.game = reduce(game, { type: 'toVote' })
      return true

    case 'resolve':
      requireHost(isHost)
      if (!game || game.phase !== 'ejected') return false
      room.game = reduce(game, { type: 'resolveEjection' })
      return true

    case 'lastChance':
      requireHost(isHost)
      if (!game || game.phase !== 'lastChance') return false
      room.game = reduce(game, { type: 'lastChance', correct: Boolean(action.correct) })
      return true

    case 'nextRound': {
      requireHost(isHost)
      if (!game || game.phase !== 'roundEnd') return false
      room.game = isLastRound(game)
        ? reduce(game, { type: 'endGame' })
        : reduce(game, {
            type: 'startRound',
            round: makeRound(game.round.index + 1, game.players, game.settings, game.usedWords),
          })
      return true
    }

    case 'restart':
      requireHost(isHost)
      if (!game || game.phase !== 'gameEnd') return false
      // Same crew, same settings, scores back to zero.
      room.game = createGame(room.players, room.settings)
      return true

    default:
      throw new Error('unknown-action')
  }
}

function requireHost(isHost: boolean) {
  if (!isHost) throw new Error('host-only')
}

/** Plurality wins; a tie means nobody leaves, which is the common house rule. */
function tally(votes: Record<string, string>): string | null {
  const counts = new Map<string, number>()
  for (const target of Object.values(votes)) {
    if (!target) continue
    counts.set(target, (counts.get(target) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  let tied = false
  for (const [target, count] of counts) {
    if (count > bestCount) {
      best = target
      bestCount = count
      tied = false
    } else if (count === bestCount) {
      tied = true
    }
  }
  return tied ? null : best
}
