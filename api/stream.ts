import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isValidCode } from '../src/online/protocol.js'
import * as kv from './_lib/kv.js'
import { authorize, loadRoom, touchPresence, versionKey, viewFor } from './_lib/room.js'

/**
 * Server-sent events: the phone holds one connection and gets the room pushed
 * whenever its version counter moves. Serverless functions cannot run forever,
 * so the stream closes itself just under the limit and EventSource reconnects
 * on its own — the client never notices more than a skipped heartbeat.
 */

export const config = { maxDuration: 60 }

const WINDOW_MS = 50_000
const POLL_MS = 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!kv.kvConfigured) return res.status(503).json({ error: 'storage-unconfigured' })

  const code = String(req.query.code ?? '').toUpperCase()
  const playerId = String(req.query.playerId ?? '')
  const token = String(req.query.token ?? '')

  if (!isValidCode(code)) return res.status(400).json({ error: 'bad-code' })

  const room = await loadRoom(code)
  if (!room) return res.status(404).json({ error: 'no-such-room' })
  if (!authorize(room, playerId, token)) return res.status(403).json({ error: 'not-a-member' })

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  // Proxies that buffer would defeat the whole point.
  res.setHeader('X-Accel-Buffering', 'no')

  let open = true
  req.on('close', () => {
    open = false
  })

  const send = (event: string, data: unknown) => {
    if (!open) return
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Windows end every ~50s by design, so reconnect fast rather than after
  // the browser default of three seconds.
  res.write('retry: 700\n\n')

  await touchPresence(code, playerId)
  let version = Number((await kv.get(versionKey(code))) ?? 0)
  send('state', await viewFor(room, playerId, version))

  const startedAt = Date.now()
  while (open && Date.now() - startedAt < WINDOW_MS) {
    await sleep(POLL_MS)
    if (!open) break
    try {
      const latest = Number((await kv.get(versionKey(code))) ?? 0)
      if (latest === version) {
        // Keeps mobile networks from dropping an idle connection.
        send('ping', latest)
        continue
      }
      version = latest
      const fresh = await loadRoom(code)
      if (!fresh) {
        send('gone', { reason: 'expired' })
        break
      }
      send('state', await viewFor(fresh, playerId, version))
    } catch {
      send('ping', version)
    }
  }

  if (open) {
    send('bye', { reason: 'window' })
    res.end()
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
