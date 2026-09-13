/**
 * Minimal Upstash Redis client over their REST API — no dependency, because
 * the game needs exactly seven commands and nothing else.
 * Credentials come from the Vercel/Upstash marketplace integration.
 *
 * Without credentials the same seven commands run against an in-memory store,
 * so `npm run dev` plays the online mode across browser tabs with no cloud at
 * all. That fallback is refused on Vercel: there, missing credentials are a
 * misconfiguration we want to see, not paper over.
 */

const URL_ = process.env.KV_REST_API_URL
const TOKEN = process.env.KV_REST_API_TOKEN
const onVercel = Boolean(process.env.VERCEL)

const remote = Boolean(URL_ && TOKEN)
export const kvConfigured = remote || !onVercel

type Command = (string | number)[]

// ------------------------------------------------------------- local store

type Entry = { value: unknown; expires: number }
const store = new Map<string, Entry>()

function live(key: string): Entry | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (entry.expires && entry.expires < Date.now()) {
    store.delete(key)
    return undefined
  }
  return entry
}

function local(command: Command): unknown {
  const [op, key, ...rest] = command.map(String)
  switch (op) {
    case 'GET':
      return (live(key)?.value as string | undefined) ?? null
    case 'SET': {
      const nx = rest.includes('NX')
      if (nx && live(key)) return null
      const exAt = rest.indexOf('EX')
      const ttl = exAt >= 0 ? Number(rest[exAt + 1]) : 0
      store.set(key, { value: rest[0], expires: ttl ? Date.now() + ttl * 1000 : 0 })
      return 'OK'
    }
    case 'INCR': {
      const next = Number((live(key)?.value as string) ?? 0) + 1
      store.set(key, { value: String(next), expires: live(key)?.expires ?? 0 })
      return next
    }
    case 'EXPIRE': {
      const entry = live(key)
      if (entry) entry.expires = Date.now() + Number(rest[0]) * 1000
      return entry ? 1 : 0
    }
    case 'HSET': {
      const map = (live(key)?.value as Record<string, string>) ?? {}
      map[rest[0]] = rest[1]
      store.set(key, { value: map, expires: live(key)?.expires ?? 0 })
      return 1
    }
    case 'HGETALL': {
      const map = (live(key)?.value as Record<string, string>) ?? {}
      return Object.entries(map).flat()
    }
    case 'SADD': {
      const set = (live(key)?.value as string[]) ?? []
      if (!set.includes(rest[0])) set.push(rest[0])
      store.set(key, { value: set, expires: live(key)?.expires ?? 0 })
      return 1
    }
    case 'SMEMBERS':
      return ((live(key)?.value as string[]) ?? []).slice()
    case 'DEL':
      return [key, ...rest].reduce((n, k) => n + (store.delete(k) ? 1 : 0), 0)
    default:
      throw new Error(`unsupported command ${op}`)
  }
}

// ------------------------------------------------------------- transport

async function send<T>(body: unknown, path = ''): Promise<T> {
  const res = await fetch(`${URL_}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Redis ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

export async function cmd<T = unknown>(command: Command): Promise<T> {
  if (!remote) {
    if (onVercel) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set')
    return local(command) as T
  }
  const { result } = await send<{ result: T }>(command)
  return result
}

export const get = (key: string) => cmd<string | null>(['GET', key])

export const setEx = (key: string, value: string, seconds: number) =>
  cmd(['SET', key, value, 'EX', seconds])

export const incr = (key: string) => cmd<number>(['INCR', key])

export const expire = (key: string, seconds: number) => cmd(['EXPIRE', key, seconds])

/** Returns true only for the caller that actually took the lock. */
export async function claim(key: string, seconds: number): Promise<boolean> {
  const result = await cmd<string | null>(['SET', key, '1', 'NX', 'EX', seconds])
  return result === 'OK'
}

export const hset = (key: string, field: string, value: string) => cmd(['HSET', key, field, value])

export const hgetall = async (key: string): Promise<Record<string, string>> => {
  const flat = await cmd<string[] | null>(['HGETALL', key])
  const out: Record<string, string> = {}
  if (!flat) return out
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1]
  return out
}

export const sadd = (key: string, member: string) => cmd<number>(['SADD', key, member])

export const smembers = (key: string) => cmd<string[]>(['SMEMBERS', key])

export const del = (...keys: string[]) => cmd(['DEL', ...keys])
