import type { VercelRequest, VercelResponse } from '@vercel/node'
import { MAX_PLAYERS } from '../src/game/state.js'
import { isValidCode } from '../src/online/protocol.js'
import { kvConfigured } from './_lib/kv.js'
import {
  authorize,
  createRoom,
  fail,
  loadRoom,
  newPlayerId,
  newToken,
  presentPlayers,
  saveRoom,
  seatedPlayers,
  settleClock,
  touchPresence,
  versionKey,
  viewFor,
} from './_lib/room.js'
import { get } from './_lib/kv.js'

const cleanName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, 16) : ''

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!kvConfigured) return fail(res, 503, 'storage-unconfigured')

  // A quick look before joining: does this code exist, and who is already in?
  if (req.method === 'GET') {
    const code = String(req.query.code ?? '').toUpperCase()
    if (!isValidCode(code)) return fail(res, 400, 'bad-code')
    const room = await loadRoom(code)
    if (!room) return fail(res, 404, 'no-such-room')
    const present = await presentPlayers(code)
    return res.status(200).json({
      code: room.code,
      stage: room.game ? 'game' : 'lobby',
      // A seat whose phone left is not in the room any more, so it is not in
      // the peek either. The name it holds still answers to a rejoin — that is
      // how you walk back into your own seat, score and all.
      players: seatedPlayers(room).map((p) => ({ name: p.name, online: present.has(p.id) })),
    })
  }

  if (req.method !== 'POST') return fail(res, 405, 'method-not-allowed')

  const body = (req.body ?? {}) as Record<string, unknown>
  const op = body.op

  if (op === 'create') {
    const name = cleanName(body.name)
    if (!name) return fail(res, 400, 'name-required')
    const lang = body.lang === 'en' ? 'en' : 'de'
    const { room, token } = await createRoom(name, lang)
    await touchPresence(room.code, room.hostId)
    return res.status(200).json({ code: room.code, playerId: room.hostId, token })
  }

  if (op === 'join') {
    const code = String(body.code ?? '').toUpperCase()
    const name = cleanName(body.name)
    if (!isValidCode(code)) return fail(res, 400, 'bad-code')
    if (!name) return fail(res, 400, 'name-required')

    const room = await loadRoom(code)
    if (!room) return fail(res, 404, 'no-such-room')

    /**
     * Someone whose phone dropped out is not a stranger: if their seat is
     * empty, the same name walks straight back into it — mid-game too, where
     * the round still refers to that seat. A fresh token comes with it, so
     * the new device is the one that holds the seat from now on.
     */
    const seat = room.players.find((p) => sameName(p.name, name))
    if (seat) {
      const present = await presentPlayers(code)
      if (present.has(seat.id)) return fail(res, 409, 'name-taken')
      const token = newToken()
      room.secrets[seat.id] = token
      // Back in the room, and back in the list — but not back into the round
      // they walked out of; the next one deals them a card again.
      room.away = (room.away ?? []).filter((id) => id !== seat.id)
      settleClock(room)
      await saveRoom(room)
      await touchPresence(code, seat.id)
      return res.status(200).json({ code, playerId: seat.id, token, rejoined: true })
    }

    // A new face can only take a seat before the first card is dealt.
    if (room.game) return fail(res, 409, 'already-started')
    if (room.players.length >= MAX_PLAYERS) return fail(res, 409, 'room-full')

    const playerId = newPlayerId()
    const token = newToken()
    room.players.push({ id: playerId, name, score: 0 })
    room.secrets[playerId] = token
    await saveRoom(room)
    await touchPresence(code, playerId)
    return res.status(200).json({ code, playerId, token })
  }

  // A reload asks for the current picture with credentials it already holds.
  if (op === 'snapshot') {
    const code = String(body.code ?? '').toUpperCase()
    const playerId = String(body.playerId ?? '')
    const token = String(body.token ?? '')
    if (!isValidCode(code)) return fail(res, 400, 'bad-code')
    const room = await loadRoom(code)
    if (!room) return fail(res, 404, 'no-such-room')
    if (!authorize(room, playerId, token)) return fail(res, 403, 'not-a-member')
    await touchPresence(code, playerId)
    if (settleClock(room)) await saveRoom(room)
    const version = Number((await get(versionKey(code))) ?? 0)
    return res.status(200).json(await viewFor(room, playerId, version))
  }

  return fail(res, 400, 'unknown-op')
}
