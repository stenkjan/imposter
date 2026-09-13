import type { VercelRequest, VercelResponse } from '@vercel/node'
import { MAX_PLAYERS } from '../src/game/state'
import { isValidCode } from '../src/online/protocol'
import { kvConfigured } from './_lib/kv'
import {
  authorize,
  createRoom,
  fail,
  loadRoom,
  newPlayerId,
  newToken,
  saveRoom,
  touchPresence,
  versionKey,
  viewFor,
} from './_lib/room'
import { get } from './_lib/kv'

const cleanName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, 16) : ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!kvConfigured) return fail(res, 503, 'storage-unconfigured')

  // A quick look before joining: does this code exist, and who is already in?
  if (req.method === 'GET') {
    const code = String(req.query.code ?? '').toUpperCase()
    if (!isValidCode(code)) return fail(res, 400, 'bad-code')
    const room = await loadRoom(code)
    if (!room) return fail(res, 404, 'no-such-room')
    return res.status(200).json({
      code: room.code,
      stage: room.game ? 'game' : 'lobby',
      players: room.players.map((p) => p.name),
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
    if (room.game) return fail(res, 409, 'already-started')
    if (room.players.length >= MAX_PLAYERS) return fail(res, 409, 'room-full')
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return fail(res, 409, 'name-taken')
    }

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
    const version = Number((await get(versionKey(code))) ?? 0)
    return res.status(200).json(await viewFor(room, playerId, version))
  }

  return fail(res, 400, 'unknown-op')
}
