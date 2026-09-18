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
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(String(data.error ?? res.status))
  return data as T
}

export type RoomPeek = {
  code: string
  stage: 'lobby' | 'game'
  players: Array<{ name: string; online: boolean }>
}

export const createRoom = (name: string, lang: Lang) =>
  post<Credentials>('/api/room', { op: 'create', name, lang })

export const joinRoom = (code: string, name: string) =>
  post<Credentials & { rejoined?: boolean }>('/api/room', {
    op: 'join',
    code: code.toUpperCase(),
    name,
  })

/** Who is already in there, so a returning player can find their own seat. */
export async function peekRoom(code: string): Promise<RoomPeek | null> {
  try {
    const res = await fetch(`/api/room?code=${encodeURIComponent(code.toUpperCase())}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as RoomPeek
  } catch {
    return null
  }
}

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
  /** False while nothing has arrived for a while; the UI shows a quiet hint. */
  live: boolean
  error: string | null
  act: (action: ClientAction) => Promise<void>
  /** Fetch the room right now — the manual way out of a bad connection. */
  refresh: () => Promise<void>
}

/** Nothing heard from the stream for this long: fetch the room ourselves. */
const STALE_MS = 4000
/** Still nothing: the stream is not coming back on its own, so replace it. */
const DEAD_MS = 11_000
const CHECK_MS = 1500
const POLL_MS = 3000

const fatal = (message: string) => message === 'no-such-room' || message === 'not-a-member'

/**
 * Holds one EventSource on the room, and a safety net under it.
 *
 * The stream is the fast path: the server closes it just under the serverless
 * time limit, so short reconnects are normal and deliberately do not surface
 * as errors. The net matters more. A backgrounded phone — the host's, usually —
 * comes back with an EventSource that never reconnects, and the old build then
 * sat there showing a round that had moved on until somebody reloaded. So a
 * timer watches the stream: quiet for a few seconds and we fetch the room over
 * plain HTTP, quiet for ten and we throw the stream away and open a new one.
 * Where server-sent events are blocked outright, the polling alone keeps the
 * game playable.
 */
export function useRoom(creds: Credentials | null, onGone: () => void): Connection {
  const [view, setView] = useState<RoomView | null>(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  const version = useRef(-1)
  /** Last sign of life from the stream itself. */
  const lastEvent = useRef(0)
  /** Last time we had fresh room data from anywhere. */
  const lastSync = useRef(0)
  const polling = useRef(false)
  const gone = useRef(onGone)
  gone.current = onGone

  // Never let a stale frame overwrite a newer one from an action response.
  const accept = useCallback((next: RoomView) => {
    lastSync.current = Date.now()
    setLive(true)
    if (next.version < version.current) return
    version.current = next.version
    setView(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!creds || polling.current) return
    polling.current = true
    try {
      accept(await snapshot(creds))
      setError(null)
    } catch (e) {
      if (e instanceof ApiError && fatal(e.message)) return gone.current()
      setLive(false)
    } finally {
      polling.current = false
    }
  }, [creds, accept])

  // ---------------------------------------------------------------- stream

  useEffect(() => {
    if (!creds) return
    version.current = -1
    lastEvent.current = Date.now()
    lastSync.current = Date.now()

    const query = new URLSearchParams(creds as unknown as Record<string, string>)
    const source = new EventSource(`/api/stream?${query}`)

    // A heartbeat is not just "the socket is open": the server only sends one
    // when the room version has not moved, so it is a statement that what we
    // are showing is still current. Counting it as a sync is what keeps the
    // watchdog below quiet while the stream is doing its job.
    const beat = () => {
      const now = Date.now()
      lastEvent.current = now
      lastSync.current = now
      setLive(true)
      setError(null)
    }

    source.addEventListener('state', (event) => {
      beat()
      accept(JSON.parse((event as MessageEvent).data) as RoomView)
    })
    source.addEventListener('ping', beat)
    source.addEventListener('gone', () => {
      source.close()
      gone.current()
    })
    source.onerror = () => {
      // A reconnect between windows takes well under a second, so this is not
      // worth telling anyone about; the watchdog below decides when it is.
      if (Date.now() - lastSync.current > STALE_MS) setLive(false)
    }

    return () => source.close()
  }, [creds, accept, generation])

  // ---------------------------------------------------------------- the net

  useEffect(() => {
    if (!creds) return
    let lastPoll = 0
    let lastSwap = Date.now()

    const check = () => {
      const now = Date.now()
      if (now - lastSync.current > STALE_MS && now - lastPoll > POLL_MS) {
        lastPoll = now
        void refresh()
      }
      if (now - lastEvent.current > DEAD_MS && now - lastSwap > DEAD_MS) {
        // The stream is not coming back by itself. Build a new one.
        lastSwap = now
        lastEvent.current = now
        setGeneration((g) => g + 1)
      }
      if (now - lastSync.current > DEAD_MS) setError('reconnecting')
    }

    // Coming back to the foreground is the moment a dead stream shows itself,
    // so fetch at once — unless the stream kept beating anyway, in which case
    // there is nothing to catch up on.
    const wake = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastSync.current < STALE_MS) return
      lastPoll = Date.now()
      void refresh()
    }

    const id = window.setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('pageshow', wake)
    window.addEventListener('focus', wake)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      window.removeEventListener('pageshow', wake)
      window.removeEventListener('focus', wake)
    }
  }, [creds, refresh])

  // ---------------------------------------------------------------- acting

  const act = useCallback(
    async (action: ClientAction) => {
      if (!creds) return
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          accept(await sendAction(creds, action))
          setError(null)
          return
        } catch (e) {
          if (e instanceof ApiError) {
            if (fatal(e.message)) return gone.current()
            setError(e.message)
            return
          }
          // A dropped request on a phone changing cells: try once more, then
          // at least make sure the screen is not left behind.
          if (attempt) {
            setError('somethingWentWrong')
            void refresh()
          }
        }
      }
    },
    [creds, accept, refresh],
  )

  return { view, live, error, act, refresh }
}
