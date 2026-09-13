/**
 * The table that outlives a single evening. Every finished game is added to a
 * per-device tally, so the same group can keep score across sessions and across
 * both play modes without anyone needing an account.
 *
 * Names are merged case-insensitively; the most recent spelling wins.
 */

const KEY = 'imposter.career'
const SEEN_KEY = 'imposter.career.seen'
const SEEN_LIMIT = 40

export type Career = {
  name: string
  games: number
  points: number
  wins: number
}

type Store = Record<string, Career>

const keyFor = (name: string) => name.trim().toLowerCase()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode — the evening still counts, it just is not remembered */
  }
}

export function readCareer(): Career[] {
  const store = read<Store>(KEY, {})
  return Object.values(store).sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name),
  )
}

/**
 * Adds one finished game. `gameId` makes this idempotent: a re-render, a
 * reload or a second device watching the same room cannot double-count.
 */
export function recordGame(gameId: string, players: Array<{ name: string; score: number }>): void {
  if (!gameId || players.length === 0) return

  const seen = read<string[]>(SEEN_KEY, [])
  if (seen.includes(gameId)) return

  const top = Math.max(...players.map((p) => p.score))
  const store = read<Store>(KEY, {})

  for (const player of players) {
    const key = keyFor(player.name)
    if (!key) continue
    const current = store[key] ?? { name: player.name, games: 0, points: 0, wins: 0 }
    store[key] = {
      name: player.name,
      games: current.games + 1,
      points: current.points + player.score,
      // A goalless game has no winner to crown.
      wins: current.wins + (top > 0 && player.score === top ? 1 : 0),
    }
  }

  write(KEY, store)
  write(SEEN_KEY, [...seen, gameId].slice(-SEEN_LIMIT))
}

export function resetCareer(): void {
  write(KEY, {})
  write(SEEN_KEY, [])
}

export const careerIsEmpty = () => readCareer().length === 0
