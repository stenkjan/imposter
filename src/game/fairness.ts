/**
 * The dice, bent a little.
 *
 * Pure randomness is unfair often enough to be noticed at the table: the same
 * person draws the imposter card three rounds running, or the imposter has to
 * open the round with nothing to go on. Both are damped here with weights
 * rather than hard rules — a repeat stays possible, it just stops being
 * common — so nothing about the next round becomes predictable.
 *
 * Everything in here is pure: the random source is passed in, so the same seed
 * produces the same round on every device.
 */

export type Rnd = () => number

/**
 * Draws `count` distinct items, each with a chance proportional to its weight.
 * Weights of zero never come up unless there is nothing else left to draw.
 */
export function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  rnd: Rnd = Math.random,
): T[] {
  const pool = items.slice()
  const picked: T[] = []

  while (picked.length < count && pool.length) {
    const weights = pool.map((item) => Math.max(weightOf(item), 1e-6))
    const total = weights.reduce((sum, w) => sum + w, 0)
    let ticket = rnd() * total
    let index = weights.length - 1
    for (let i = 0; i < weights.length; i++) {
      ticket -= weights[i]
      if (ticket <= 0) {
        index = i
        break
      }
    }
    picked.push(pool[index])
    pool.splice(index, 1)
  }

  return picked
}

// ------------------------------------------------------------- imposter draw

/** How many rounds in a row, counting back from the last one, this player was the imposter. */
export function imposterStreak(history: readonly string[][], id: string): number {
  let streak = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i].includes(id)) break
    streak++
  }
  return streak
}

/** Rounds since this player last had the card; the full history when never. */
export function imposterDrought(history: readonly string[][], id: string): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].includes(id)) return history.length - 1 - i
  }
  return history.length
}

/**
 * The weight one player carries into the draw. `fairness` scales the whole
 * effect: at 0 everyone weighs the same and the draw is plain chance, at 1 a
 * player who just had the card weighs a quarter of a fresh one — and one who
 * had it twice a sixteenth, which is what keeps three in a row rare.
 */
export function imposterWeight(streak: number, drought: number, fairness: number): number {
  const strength = Math.min(Math.max(fairness, 0), 1)
  if (!strength) return 1
  const damping = 1 - 0.75 * strength
  const patience = 1 + 0.2 * strength * Math.min(drought, 5)
  return damping ** streak * patience
}

export function pickImposters(
  ids: readonly string[],
  count: number,
  history: readonly string[][],
  fairness: number,
  rnd: Rnd = Math.random,
): string[] {
  return weightedPick(
    ids,
    (id) => imposterWeight(imposterStreak(history, id), imposterDrought(history, id), fairness),
    count,
    rnd,
  )
}

// ------------------------------------------------------------- speaking order

export type OrderMode =
  /** The lobby line-up, with the opening chair moving on one seat each round. */
  | 'rotate'
  /** Exactly the lobby line-up, every round. */
  | 'lobby'
  /** Shuffled fresh every round. */
  | 'random'

const rotate = (ids: readonly string[], by: number): string[] => {
  if (!ids.length) return []
  const offset = ((by % ids.length) + ids.length) % ids.length
  return [...ids.slice(offset), ...ids.slice(0, offset)]
}

/** Going first or last is the worst seat for an imposter: no clues, or every clue. */
const edgesAreClean = (order: readonly string[], imposterIds: readonly string[]): boolean =>
  order.length < 3 ||
  (!imposterIds.includes(order[0]) && !imposterIds.includes(order[order.length - 1]))

/**
 * Moves an imposter off the first and last chair, `chance` of the time. Doing
 * it always would turn the seating into a tell of its own — if the opener were
 * never the imposter, the table would know it after one evening.
 */
function easeEdges(
  order: readonly string[],
  imposterIds: readonly string[],
  chance: number,
  rnd: Rnd,
): string[] {
  const out = order.slice()
  if (out.length < 3 || chance <= 0) return out

  for (const edge of [0, out.length - 1]) {
    if (!imposterIds.includes(out[edge])) continue
    if (rnd() >= chance) continue
    const middle = out
      .map((id, i) => ({ id, i }))
      .filter(({ id, i }) => i !== 0 && i !== out.length - 1 && !imposterIds.includes(id))
    if (!middle.length) continue
    const swap = middle[Math.floor(rnd() * middle.length)].i
    ;[out[edge], out[swap]] = [out[swap], out[edge]]
  }

  return out
}

function shuffle(items: readonly string[], rnd: Rnd): string[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The order everyone speaks in. `ids` arrives in the order the host arranged
 * in the lobby, which is what the two rotating modes preserve.
 */
export function buildOrder(
  ids: readonly string[],
  imposterIds: readonly string[],
  mode: OrderMode,
  roundIndex: number,
  edgeAvoidance: number,
  rnd: Rnd = Math.random,
): string[] {
  if (mode === 'lobby') return ids.slice()

  if (mode === 'rotate') {
    // Every seat gets its turn at opening; among those offsets, prefer the
    // ones that keep an imposter out of the two exposed chairs.
    const offsets = ids.map((_, i) => (roundIndex + i) % ids.length)
    const wanted = offsets.find((by) => edgesAreClean(rotate(ids, by), imposterIds))
    const natural = offsets[0]
    const chosen = wanted !== undefined && rnd() < edgeAvoidance ? wanted : natural
    return rotate(ids, chosen)
  }

  return easeEdges(shuffle(ids, rnd), imposterIds, edgeAvoidance, rnd)
}
