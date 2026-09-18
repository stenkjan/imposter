import type { Lang } from '../../src/game/i18n.js'
import {
  clockHasRun,
  defaultSettings,
  normaliseSettings,
  reduce,
  roundCategory,
  roundWord,
  type GameState,
  type Player,
  type Settings,
} from '../../src/game/state.js'
import {
  CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type PlayerView,
  type RoomView,
} from '../../src/online/protocol.js'
import * as kv from './kv.js'

/** Rooms are ephemeral: a party ends, the keys expire, nothing to clean up. */
export const ROOM_TTL = 6 * 60 * 60
const PRESENCE_TTL = 100

export type Room = {
  code: string
  lang: Lang
  hostId: string
  settings: Settings
  /** Also the speaking order: the host arranges this list in the lobby. */
  players: Player[]
  /** playerId -> bearer token. Never leaves the server. */
  secrets: Record<string, string>
  game: GameState | null
  /** Imposters of every round played in this room, across restarts. */
  imposterHistory?: string[][]
  createdAt: number
}

const roomKey = (code: string) => `room:${code}`
export const versionKey = (code: string) => `room:${code}:v`
const seenKey = (code: string) => `room:${code}:seen`

/**
 * Per-round keys carry the game id. Without it a rematch would inherit the
 * first game's ticks — everyone "ready" before anyone had looked, and a vote
 * from the previous game resolving the new one on the spot.
 */
const readyKey = (code: string, gameId: string, round: number) =>
  `room:${code}:${gameId}:ready:${round}`
const voteKey = (code: string, gameId: string, round: number, pass: number) =>
  `room:${code}:${gameId}:votes:${round}:${pass}`
const lockKey = (code: string, what: string) => `room:${code}:lock:${what}`

export const keysFor = { readyKey, voteKey, lockKey }

const random = (n: number) => {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return bytes
}

export function newCode(): string {
  return [...random(ROOM_CODE_LENGTH)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export const newToken = () => [...random(24)].map((b) => b.toString(16).padStart(2, '0')).join('')

export const newPlayerId = () => `p_${newToken().slice(0, 12)}`

export async function loadRoom(code: string): Promise<Room | null> {
  const raw = await kv.get(roomKey(code))
  if (!raw) return null
  const room = JSON.parse(raw) as Room
  // A room can outlive a deploy, so an older document is repaired on read.
  room.settings = normaliseSettings(room.settings, room.players.length)
  room.imposterHistory ??= []
  return room
}

/** Persists the room and bumps the version every stream is watching. */
export async function saveRoom(room: Room): Promise<number> {
  await kv.setEx(roomKey(room.code), JSON.stringify(room), ROOM_TTL)
  const version = await kv.incr(versionKey(room.code))
  await kv.expire(versionKey(room.code), ROOM_TTL)
  return version
}

export async function createRoom(
  hostName: string,
  lang: Lang,
): Promise<{ room: Room; token: string }> {
  // Four characters is 1M combinations; a couple of tries is plenty.
  let code = newCode()
  for (let i = 0; i < 5 && (await kv.get(roomKey(code))); i++) code = newCode()

  const hostId = newPlayerId()
  const token = newToken()
  const room: Room = {
    code,
    lang,
    hostId,
    settings: defaultSettings(4),
    players: [{ id: hostId, name: hostName, score: 0 }],
    secrets: { [hostId]: token },
    game: null,
    imposterHistory: [],
    createdAt: Date.now(),
  }
  await saveRoom(room)
  return { room, token }
}

export function authorize(room: Room, playerId: string, token: string): boolean {
  return Boolean(playerId) && room.secrets[playerId] === token
}

/**
 * Hands the room over when the host walks out. Someone still on their phone is
 * preferred; otherwise the next person in the roster inherits it.
 */
export function handOverHost(room: Room, leaving: string, present: Set<string>): void {
  if (room.hostId !== leaving) return
  const others = room.players.filter((p) => p.id !== leaving)
  const successor = others.find((p) => present.has(p.id)) ?? others[0]
  if (successor) room.hostId = successor.id
}

/** Settings from a client are never trusted as they arrive. */
export const clampSettings = normaliseSettings

// ------------------------------------------------------------- the clock

/**
 * One clock runs the whole round, and it is the server that decides when it is
 * up — a phone that fell asleep must not be able to stop the round, and the
 * bonus for holding out to the last second has to be the same for everyone.
 */
export function settleClock(room: Room, now = Date.now()): boolean {
  const game = room.game
  if (!game || game.round.clockExpired) return false
  if (!['discuss', 'vote', 'standoff'].includes(game.phase)) return false
  if (!clockHasRun(game.round, now)) return false
  room.game = reduce(game, { type: 'expireClock' })
  return true
}

/**
 * Called from the streams, so the vote opens by itself even when nobody
 * touches their phone. The lock means only one of them writes.
 */
export async function tickClock(code: string): Promise<void> {
  const room = await loadRoom(code)
  const game = room?.game
  if (!room || !game || game.round.clockExpired) return
  if (!clockHasRun(game.round, Date.now())) return
  const lock = lockKey(code, `clock:${game.id}:${game.round.index}`)
  if (!(await kv.claim(lock, 30))) return
  if (settleClock(room)) await saveRoom(room)
}

// ------------------------------------------------------------- presence

export async function touchPresence(code: string, playerId: string) {
  await kv.hset(seenKey(code), playerId, String(Date.now()))
  await kv.expire(seenKey(code), ROOM_TTL)
}

/** Marks someone as gone right now instead of waiting for presence to lapse. */
export async function forgetPresence(code: string, playerId: string) {
  await kv.hset(seenKey(code), playerId, '0')
}

export async function presentPlayers(code: string): Promise<Set<string>> {
  const seen = await kv.hgetall(seenKey(code))
  const cutoff = Date.now() - PRESENCE_TTL * 1000
  return new Set(
    Object.entries(seen)
      .filter(([, at]) => Number(at) > cutoff)
      .map(([id]) => id),
  )
}

// ------------------------------------------------------------- the view

/** Everything one specific phone is allowed to know right now. */
export async function viewFor(room: Room, playerId: string, version: number): Promise<RoomView> {
  const online = await presentPlayers(room.code)
  const game = room.game

  let ready = new Set<string>()
  let votes: Record<string, string> = {}
  if (game) {
    if (game.phase === 'reveal') {
      ready = new Set(await kv.smembers(readyKey(room.code, game.id, game.round.index)))
    }
    if (game.phase === 'vote') {
      votes = await kv.hgetall(voteKey(room.code, game.id, game.round.index, game.round.pass))
    }
  }

  // Scores live on the running game, not on the room roster.
  const scores = new Map((game?.players ?? room.players).map((p) => [p.id, p.score]))

  const players: PlayerView[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: scores.get(p.id) ?? 0,
    online: online.has(p.id) || p.id === playerId,
    ready: ready.has(p.id),
    voted: p.id in votes,
  }))

  return {
    code: room.code,
    lang: room.lang,
    settings: room.settings,
    players,
    hostId: room.hostId,
    youId: playerId,
    stage: game ? 'game' : 'lobby',
    gameId: game?.id ?? null,
    version,
    round: game ? roundView(game, room, playerId, votes) : null,
  }
}

function roundView(
  game: GameState,
  room: Room,
  playerId: string,
  votes: Record<string, string>,
): RoomView['round'] {
  const { round, phase } = game
  const imposter = round.imposterIds.includes(playerId)
  const category = roundCategory(round)
  const over = phase === 'roundEnd' || phase === 'gameEnd' || phase === 'lastChance'
  const hideWord = imposter && !over
  const hideCategory = imposter && !over && !room.settings.hintForImposter
  const ejected = round.ejectedId

  return {
    index: round.index,
    rounds: room.settings.rounds,
    phase,
    pass: round.pass,
    alive: round.alive,
    order: round.order,
    word: hideWord ? null : roundWord(round)[room.lang],
    category: hideCategory ? null : { emoji: category.emoji, name: category.name[room.lang] },
    imposter,
    ejectedId: ejected,
    // Ejecting someone reveals that one person, never the rest of the crew.
    ejectedWasImposter:
      ejected && (phase === 'ejected' || over) ? round.imposterIds.includes(ejected) : null,
    imposterIds: over ? round.imposterIds : null,
    outcome: round.outcome,
    imposterGuessedRight: round.imposterGuessedRight,
    myVote: votes[playerId] ?? null,
    deadlineAt: round.deadlineAt,
    pausedAt: round.pausedAt,
    clockExpired: round.clockExpired,
    // A score that moved mid-round would say who guessed right.
    earned: over ? round.earned : null,
  }
}

// ------------------------------------------------------------- http helpers

export type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

export const fail = (res: Res, status: number, error: string) => {
  res.status(status).json({ error })
}
