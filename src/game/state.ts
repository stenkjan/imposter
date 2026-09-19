import { buildOrder, pickImposters, type OrderMode, type Rnd } from './fairness.js'
import { CATEGORIES, CATEGORY_BY_ID, type Word } from './words.js'

/**
 * The whole game as plain, serialisable data plus a pure reducer.
 * Nothing in here touches React, the DOM or the clock, so the same module can
 * drive an online room: one device computes the next round, broadcasts the
 * action, every device reduces to the same state. Where a moment in time
 * matters — when the discussion clock starts, stops or is paused — the caller
 * passes it in rather than the reducer reading it.
 */

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

export type Phase =
  | 'reveal' // passing the phone around, everyone peeks at their card
  | 'discuss' // clues and argument, on the round's shared clock
  | 'vote' // the table picks someone to eject
  | 'ejected' // showing who that was
  | 'standoff' // the vote settled nothing: vote again, or another word round
  | 'lastChance' // caught imposter may still guess the word
  | 'roundEnd' // round scored
  | 'gameEnd' // all rounds played

/**
 * What a round is worth. Every line is a knob in the settings, so a table that
 * wants a different balance does not need a new build — and a line set to 0 is
 * simply switched off.
 */
export type ScoreRules = {
  /** To each civilian whose vote landed on an imposter. */
  voteCorrect: number
  /** To every imposter still in the game after a vote is resolved. */
  imposterSurvive: number
  /** To a caught imposter who still names the word. */
  imposterGuess: number
  /** To every imposter alive when the clock runs out and the vote is forced. */
  clockSurvived: number
  /** Flat bonus for the side that takes the round; off by default. */
  civilianWin: number
  imposterWin: number
}

/**
 * What the imposter is told about the word they did not get.
 * 'none' — nothing at all, the hardest setting for them.
 * 'category' — the category, which the first clue usually gives away anyway.
 * 'near' — the category plus a neighbour of the word (see Word.near): enough
 * to bluff in the right direction, never enough to name it.
 */
export type ImposterHint = 'none' | 'category' | 'near'

export type Settings = {
  imposters: number
  imposterHint: ImposterHint
  rounds: number
  /** Seconds on the discussion clock; 0 means no clock at all. */
  timerSeconds: number
  lastChance: boolean
  categoryIds: string[]
  /** How the speaking order is built from the lobby line-up. */
  orderMode: OrderMode
  /** 0…1 — how hard the draw pushes back against the same imposter twice. */
  imposterFairness: number
  /** 0…1 — how often an imposter is kept out of the first and last chair. */
  edgeAvoidance: number
  points: ScoreRules
}

export type Player = { id: string; name: string; score: number }

export type Round = {
  index: number
  categoryId: string
  wordIndex: number
  imposterIds: string[]
  /** Who gives a clue in which order. */
  order: string[]
  alive: string[]
  /** How many players have already seen their card this round. */
  revealed: number
  /** 1-based discussion pass; a survived vote starts the next one. */
  pass: number
  ejectedId: string | null
  outcome: 'civilians' | 'imposters' | null
  imposterGuessedRight: boolean
  /**
   * One clock for the whole round: set when the first discussion starts and
   * never rewound, so a second word round eats into the same minutes.
   */
  deadlineAt: number | null
  pausedAt: number | null
  clockExpired: boolean
  /** The clock, not a vote, ended this round — the imposters simply ran it out. */
  clockDecided: boolean
  /**
   * Points banked during the round, folded into the table only once the round
   * is scored. Keeping them here is what stops a score that ticks up mid-round
   * from telling everyone whose vote just landed on an imposter.
   */
  earned: Record<string, number>
}

export type GameState = {
  /** Unique per game, so the leaderboard cannot count one twice. */
  id: string
  settings: Settings
  players: Player[]
  round: Round
  phase: Phase
  /** "categoryId:wordIndex" keys already used, so a session does not repeat. */
  usedWords: string[]
  /** The imposters of every round so far, oldest first. Drives the fair draw. */
  imposterHistory: string[][]
}

export type Action =
  /** `deadlineAt` starts the round clock the moment the last card is turned. */
  | { type: 'revealNext'; deadlineAt?: number | null }
  | { type: 'forceReveal'; deadlineAt?: number | null }
  | { type: 'toVote' }
  | { type: 'expireClock' }
  | { type: 'pauseClock'; at: number }
  | { type: 'resumeClock'; at: number }
  /** `votes` is voter -> target; absent on one phone, where the table votes as one. */
  | { type: 'eject'; playerId: string | null; votes?: Record<string, string> }
  | { type: 'resolveEjection' }
  | { type: 'continue'; as: 'discuss' | 'vote' }
  | { type: 'lastChance'; correct: boolean }
  | { type: 'startRound'; round: Round }
  /** Somebody closed the room on their phone and is not coming back this round. */
  | { type: 'playerLeft'; playerId: string }
  | { type: 'endGame' }

// ---------------------------------------------------------------- helpers

export function shuffle<T>(items: readonly T[], rnd: Rnd = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Table from the common rule sets: more players, more imposters. */
export function recommendedImposters(playerCount: number): number {
  if (playerCount >= 9) return 3
  if (playerCount >= 6) return 2
  return 1
}

/** Civilians must always outnumber imposters at the start of a round. */
export function maxImposters(playerCount: number): number {
  return Math.max(1, Math.min(3, Math.floor((playerCount - 1) / 2)))
}

export const DEFAULT_POINTS: ScoreRules = {
  voteCorrect: 1,
  imposterSurvive: 1,
  imposterGuess: 1,
  clockSurvived: 1,
  civilianWin: 0,
  imposterWin: 0,
}

export function defaultSettings(playerCount: number): Settings {
  return {
    imposters: Math.min(recommendedImposters(playerCount), maxImposters(playerCount)),
    imposterHint: 'near',
    rounds: 3,
    timerSeconds: 120,
    lastChance: true,
    categoryIds: CATEGORIES.map((c) => c.id),
    orderMode: 'rotate',
    imposterFairness: 1,
    edgeAvoidance: 0.8,
    points: { ...DEFAULT_POINTS },
  }
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback
}

/**
 * Fills in whatever a caller left out. Settings arrive from three places that
 * can all be out of date — this phone's localStorage, a room document written
 * by an older deploy, and a client's own request — so every field is repaired
 * on the way in rather than trusted.
 */
/**
 * The hint used to be a plain on/off for the category. A stored `true` means
 * the table wanted a hint, so it is upgraded to the better one rather than
 * being pinned to the old, weaker level.
 */
function readHint(settings: Partial<Settings> | undefined, fallback: ImposterHint): ImposterHint {
  const value = settings?.imposterHint
  if (value === 'none' || value === 'category' || value === 'near') return value
  const legacy = (settings as { hintForImposter?: unknown } | undefined)?.hintForImposter
  if (typeof legacy === 'boolean') return legacy ? 'near' : 'none'
  return fallback
}

export function normaliseSettings(settings: Partial<Settings> | undefined, playerCount: number): Settings {
  const base = defaultSettings(Math.max(playerCount, 3))
  const known = base.categoryIds
  const categoryIds = (settings?.categoryIds ?? []).filter((id) => known.includes(id))
  const points = { ...DEFAULT_POINTS }
  for (const key of Object.keys(DEFAULT_POINTS) as Array<keyof ScoreRules>) {
    points[key] = Math.round(clampNumber(settings?.points?.[key], 0, 9, DEFAULT_POINTS[key]))
  }

  // Every field is listed, so nothing a client invented rides along into the
  // room document and nothing a future version adds is silently lost either.
  return {
    ...base,
    imposters: Math.round(
      clampNumber(settings?.imposters, 1, maxImposters(Math.max(playerCount, 3)), base.imposters),
    ),
    rounds: Math.round(clampNumber(settings?.rounds, 1, 20, base.rounds)),
    timerSeconds: Math.round(clampNumber(settings?.timerSeconds, 0, 3600, base.timerSeconds)),
    imposterHint: readHint(settings, base.imposterHint),
    lastChance: Boolean(settings?.lastChance ?? base.lastChance),
    orderMode:
      settings?.orderMode === 'lobby' || settings?.orderMode === 'random'
        ? settings.orderMode
        : 'rotate',
    imposterFairness: clampNumber(settings?.imposterFairness, 0, 1, base.imposterFairness),
    edgeAvoidance: clampNumber(settings?.edgeAvoidance, 0, 1, base.edgeAvoidance),
    points,
    categoryIds: categoryIds.length ? categoryIds : known,
  }
}

export function makeRound(
  index: number,
  players: Player[],
  settings: Settings,
  usedWords: readonly string[],
  imposterHistory: readonly string[][] = [],
  rnd: Rnd = Math.random,
): Round {
  const pool = settings.categoryIds.length ? settings.categoryIds : CATEGORIES.map((c) => c.id)
  const candidates: Array<{ categoryId: string; wordIndex: number }> = []
  for (const categoryId of pool) {
    const category = CATEGORY_BY_ID.get(categoryId)
    if (!category) continue
    for (let i = 0; i < category.words.length; i++) candidates.push({ categoryId, wordIndex: i })
  }
  const fresh = candidates.filter((c) => !usedWords.includes(`${c.categoryId}:${c.wordIndex}`))
  const from = fresh.length ? fresh : candidates
  const pick = from[Math.floor(rnd() * from.length)]

  // `players` is the line-up as the host arranged it, which the order modes keep.
  const ids = players.map((p) => p.id)
  const imposterIds = pickImposters(
    ids,
    Math.min(settings.imposters, maxImposters(ids.length)),
    imposterHistory,
    settings.imposterFairness,
    rnd,
  )

  return {
    index,
    categoryId: pick.categoryId,
    wordIndex: pick.wordIndex,
    imposterIds,
    order: buildOrder(ids, imposterIds, settings.orderMode, index, settings.edgeAvoidance, rnd),
    alive: ids,
    revealed: 0,
    pass: 1,
    ejectedId: null,
    outcome: null,
    imposterGuessedRight: false,
    deadlineAt: null,
    pausedAt: null,
    clockExpired: false,
    clockDecided: false,
    earned: {},
  }
}

const newGameId = () => `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * `history` carries the imposter rotation over from an earlier game in the
 * same room, so "play again" does not hand the card straight back to whoever
 * just had it.
 */
export function createGame(
  players: Player[],
  settings: Settings,
  history: readonly string[][] = [],
): GameState {
  const round = makeRound(0, players, settings, [], history)
  return {
    id: newGameId(),
    settings,
    players: players.map((p) => ({ ...p, score: 0 })),
    round,
    phase: 'reveal',
    usedWords: [wordKey(round)],
    imposterHistory: [...history, round.imposterIds],
  }
}

export const wordKey = (round: Round) => `${round.categoryId}:${round.wordIndex}`

export function roundWord(round: Round): Word {
  const category = CATEGORY_BY_ID.get(round.categoryId) ?? CATEGORIES[0]
  return category.words[round.wordIndex] ?? category.words[0]
}

export function roundCategory(round: Round) {
  return CATEGORY_BY_ID.get(round.categoryId) ?? CATEGORIES[0]
}

export const isImposter = (round: Round, playerId: string) => round.imposterIds.includes(playerId)

export const playerById = (state: GameState, id: string | null) =>
  id ? (state.players.find((p) => p.id === id) ?? null) : null

export const aliveImposters = (round: Round) =>
  round.alive.filter((id) => round.imposterIds.includes(id))

export const aliveCivilians = (round: Round) =>
  round.alive.filter((id) => !round.imposterIds.includes(id))

/** Seconds left on the round clock at moment `now`; null when there is no clock. */
export function remainingSeconds(round: Round, now: number): number | null {
  if (round.deadlineAt === null) return null
  const at = round.pausedAt ?? now
  return Math.max(0, Math.round((round.deadlineAt - at) / 1000))
}

export const clockHasRun = (round: Round, now: number): boolean =>
  round.deadlineAt !== null && round.pausedAt === null && now >= round.deadlineAt

// ---------------------------------------------------------------- scoring

/** Adds to the round's private tally; nothing reaches a score until the round ends. */
function bank(round: Round, id: string, points: number): Round {
  if (!points) return round
  return { ...round, earned: { ...round.earned, [id]: (round.earned[id] ?? 0) + points } }
}

function bankAll(round: Round, ids: readonly string[], points: number): Round {
  return ids.reduce((acc, id) => bank(acc, id, points), round)
}

/** Everything the round banked, paid out in one go. */
function payOut(state: GameState, round: Round): Player[] {
  return state.players.map((p) => ({ ...p, score: p.score + (round.earned[p.id] ?? 0) }))
}

function finish(state: GameState, round: Round): GameState {
  const { points } = state.settings
  let scored = round
  if (round.outcome === 'civilians') {
    const civilians = state.players
      .map((p) => p.id)
      .filter((id) => !round.imposterIds.includes(id))
    scored = bankAll(scored, civilians, points.civilianWin)
  }
  if (round.outcome === 'imposters') {
    scored = bankAll(scored, round.imposterIds, points.imposterWin)
  }
  return { ...state, players: payOut(state, scored), round: scored, phase: 'roundEnd' }
}

export const isLastRound = (state: GameState) => state.round.index + 1 >= state.settings.rounds

// ---------------------------------------------------------------- reducer

export function reduce(state: GameState, action: Action): GameState {
  const { round } = state
  const points = state.settings.points

  switch (action.type) {
    case 'revealNext':
    case 'forceReveal': {
      const revealed =
        action.type === 'forceReveal' ? state.players.length : round.revealed + 1
      const done = revealed >= state.players.length
      return {
        ...state,
        // The clock starts with the discussion, not with the first card.
        round: { ...round, revealed, deadlineAt: done ? (action.deadlineAt ?? null) : null },
        phase: done ? 'discuss' : 'reveal',
      }
    }

    case 'toVote':
      if (state.phase !== 'discuss' && state.phase !== 'standoff') return state
      return { ...state, phase: 'vote' }

    case 'expireClock': {
      if (round.clockExpired || round.deadlineAt === null) return state
      if (state.phase !== 'discuss' && state.phase !== 'vote' && state.phase !== 'standoff') {
        return state
      }
      // Holding out for the full clock is worth something on its own: the
      // table never managed to call a vote on them.
      const survived = bankAll(round, aliveImposters(round), points.clockSurvived)
      const next: Round = { ...survived, clockExpired: true, pausedAt: null }
      // A vote already on the table plays out — calling it in time is exactly
      // what the clock asks of the civilians, and yanking half-cast votes away
      // would punish them for beating it.
      if (state.phase === 'vote') return { ...state, round: next }
      // Otherwise the clock decides the round: nobody was ever named, so it
      // goes to the imposters.
      return finish(state, { ...next, clockDecided: true, outcome: 'imposters' })
    }

    case 'pauseClock':
      if (round.deadlineAt === null || round.pausedAt !== null) return state
      return { ...state, round: { ...round, pausedAt: action.at } }

    case 'resumeClock': {
      if (round.deadlineAt === null || round.pausedAt === null) return state
      const shift = action.at - round.pausedAt
      return { ...state, round: { ...round, pausedAt: null, deadlineAt: round.deadlineAt + shift } }
    }

    case 'eject': {
      let next: Round = { ...round, ejectedId: action.playerId }
      if (action.votes) {
        for (const [voter, target] of Object.entries(action.votes)) {
          const rightGuess = target && round.imposterIds.includes(target)
          if (rightGuess && !round.imposterIds.includes(voter)) {
            next = bank(next, voter, points.voteCorrect)
          }
        }
      } else if (action.playerId && round.imposterIds.includes(action.playerId)) {
        // One phone: the table votes as one, so the credit is shared.
        next = bankAll(next, aliveCivilians(round), points.voteCorrect)
      }
      return { ...state, phase: 'ejected', round: next }
    }

    case 'resolveEjection': {
      const alive = round.ejectedId
        ? round.alive.filter((id) => id !== round.ejectedId)
        : round.alive
      const survivors = { ...round, alive }
      const impostersLeft = aliveImposters(survivors)
      const civiliansLeft = aliveCivilians(survivors)
      // Everyone still wearing the card has survived this vote.
      const next = bankAll(survivors, impostersLeft, points.imposterSurvive)

      if (impostersLeft.length === 0) {
        const caught = { ...next, outcome: 'civilians' as const }
        if (state.settings.lastChance) return { ...state, round: caught, phase: 'lastChance' }
        return finish(state, caught)
      }
      if (impostersLeft.length >= civiliansLeft.length) {
        return finish(state, { ...next, outcome: 'imposters' as const })
      }
      // Nobody has won yet — the host decides how the table goes on.
      return { ...state, phase: 'standoff', round: next }
    }

    case 'continue':
      if (state.phase !== 'standoff') return state
      return {
        ...state,
        phase: action.as,
        round: { ...round, pass: round.pass + 1, ejectedId: null },
      }

    case 'lastChance': {
      const next = action.correct
        ? bankAll({ ...round, imposterGuessedRight: true }, round.imposterIds, points.imposterGuess)
        : { ...round, imposterGuessedRight: false }
      return finish(state, next)
    }

    case 'endGame':
      return { ...state, phase: 'gameEnd' }

    case 'playerLeft': {
      if (!round.alive.includes(action.playerId)) return state
      // Walking out is not an ejection: nobody learns the role, nobody is paid
      // for it. The seat just stops being part of the round, so the vote does
      // not sit there waiting for a phone that went home.
      const next: Round = { ...round, alive: round.alive.filter((id) => id !== action.playerId) }
      const running =
        state.phase === 'reveal' ||
        state.phase === 'discuss' ||
        state.phase === 'vote' ||
        state.phase === 'standoff'
      // Mid-resolution the pending step decides; it is about to run the same
      // two checks anyway.
      if (!running) return { ...state, round: next }

      const impostersLeft = aliveImposters(next)
      const civiliansLeft = aliveCivilians(next)
      // A round whose imposter walked out cannot be played to an end, and one
      // where they are no longer outnumbered is already decided.
      if (impostersLeft.length === 0) return finish(state, { ...next, outcome: 'civilians' })
      if (impostersLeft.length >= civiliansLeft.length) {
        return finish(state, { ...next, outcome: 'imposters' })
      }
      return { ...state, round: next }
    }

    case 'startRound':
      return {
        ...state,
        round: action.round,
        phase: 'reveal',
        usedWords: [...state.usedWords, wordKey(action.round)],
        imposterHistory: [...state.imposterHistory, action.round.imposterIds],
      }

    default:
      return state
  }
}

export function standings(players: Player[]): Player[] {
  return players.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export function winners(players: Player[]): Player[] {
  const top = Math.max(...players.map((p) => p.score))
  return players.filter((p) => p.score === top)
}
