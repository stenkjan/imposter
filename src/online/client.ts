import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '../game/i18n'
import type { ClientAction, Credentials, RoomView } from './protocol'

const CREDS_KEY = 'imposter.room'

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(String(data.error ?? res.status))
  return data as T
}

export const createRoom = (name: string, lang: Lang) =>
  post<Credentials>('/api/room', { op: 'create', name, lang })

export const joinRoom = (code: string, name: string) =>
  post<Credentials>('/api/room', { op: 'join', code: code.toUpperCase(), name })

export const snapshot = (creds: Credentials) =>
  post<RoomView>('/api/room', { op: 'snapshot', ...creds })

export const sendAction = (creds: Credentials, action: ClientAction) =>
  post<RoomView>('/api/action', { ...creds, action })

export function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    return raw ? (JSON.parse(raw) as Credentials) : null
  } catch {
    return null
  }
}

export function storeCredentials(creds: Credentials | null) {
  try {
    if (creds) localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
    else localStorage.removeItem(CREDS_KEY)
  } catch {
    /* private mode — the room simply will not survive a reload */
  }
}

export type Connection = {
  view: RoomView | null
  /** False while the stream is down; the UI shows a quiet hint, not an error. */
  live: boolean
  error: string | null
  act: (action: ClientAction) => Promise<void>
}

/**
 * Holds one EventSource on the room. The server closes the stream just under
 * the serverless time limit, so short reconnects are normal and deliberately
 * do not surface as errors — only a stream that stays down does.
 */
export function useRoom(creds: Credentials | null, onGone: () => void): Connection {
  const [view, setView] = useState<RoomView | null>(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const version = useRef(-1)
  const gone = useRef(onGone)
  gone.current = onGone

  // Never let a stale frame overwrite a newer one from an action response.
  const accept = useCallback((next: RoomView) => {
    if (next.version < version.current) return
    version.current = next.version
    setView(next)
  }, [])

  useEffect(() => {
    if (!creds) return
    version.current = -1
    const query = new URLSearchParams(creds as unknown as Record<string, string>)
    const source = new EventSource(`/api/stream?${query}`)
    let downSince = 0

    source.addEventListener('state', (event) => {
      setLive(true)
      setError(null)
      downSince = 0
      accept(JSON.parse((event as MessageEvent).data) as RoomView)
    })
    source.addEventListener('ping', () => {
      setLive(true)
      downSince = 0
    })
    source.addEventListener('gone', () => {
      source.close()
      gone.current()
    })
    source.onerror = () => {
      setLive(false)
      // A reconnect between windows takes under a second; only a real outage
      // lasts, so wait before saying anything.
      if (!downSince) downSince = Date.now()
      if (Date.now() - downSince > 6000) setError('reconnecting')
    }

    return () => source.close()
  }, [creds, accept])

  const act = useCallback(
    async (action: ClientAction) => {
      if (!creds) return
      try {
        accept(await sendAction(creds, action))
        setError(null)
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'somethingWentWrong'
        if (message === 'no-such-room' || message === 'not-a-member') return gone.current()
        setError(message)
      }
    },
    [creds, accept],
  )

  return { view, live, error, act }
}
