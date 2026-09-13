import { CATEGORIES, CATEGORY_BY_ID, type Word } from './words.js'

/**
 * The whole game as plain, serialisable data plus a pure reducer.
 * Nothing in here touches React, the DOM or randomness, so the same
 * module can later drive an online room: one device computes the next
 * round, broadcasts the action, every device reduces to the same state.
 */

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

export type Phase =
  | 'reveal' // passing the phone around, everyone peeks at their card
  | 'discuss' // clues and argument, optionally on a timer
  | 'vote' // the table picks someone to eject
  | 'ejected' // showing who that was
  | 'lastChance' // caught imposter may still guess the word
  | 'roundEnd' // round scored
  | 'gameEnd' // all rounds played

export type Settings = {
  imposters: number
  hintForImposter: boolean
  rounds: number
  /** Seconds per discussion; 0 means no timer. */
  timerSeconds: number
  lastChance: boolean
  categoryIds: string[]
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
}

export type GameState = {
  settings: Settings
  players: Player[]
  round: Round
  phase: Phase
  /** "categoryId:wordIndex" keys already used, so a session does not repeat. */
  usedWords: string[]
}

export type Action =
  | { type: 'revealNext' }
  | { type: 'toVote' }
  | { type: 'eject'; playerId: string | null }
  | { type: 'resolveEjection' }
  | { type: 'lastChance'; correct: boolean }
  | { type: 'startRound'; round: Round }
  | { type: 'endGame' }

// ---------------------------------------------------------------- helpers

export function shuffle<T>(items: readonly T[], rnd: () => number = Math.random): T[] {
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

export function defaultSettings(playerCount: number): Settings {
  return {
    imposters: Math.min(recommendedImposters(playerCount), maxImposters(playerCount)),
    hintForImposter: true,
    rounds: 3,
    timerSeconds: 120,
    lastChance: true,
    categoryIds: CATEGORIES.map((c) => c.id),
  }
}

export function makeRound(
  index: number,
  players: Player[],
  settings: Settings,
  usedWords: readonly string[],
  rnd: () => number = Math.random,
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

  const ids = players.map((p) => p.id)
  const imposterIds = shuffle(ids, rnd).slice(0, Math.min(settings.imposters, maxImposters(ids.length)))

  return {
    index,
    categoryId: pick.categoryId,
    wordIndex: pick.wordIndex,
    imposterIds,
    order: shuffle(ids, rnd),
    alive: ids,
    revealed: 0,
    pass: 1,
    ejectedId: null,
    outcome: null,
    imposterGuessedRight: false,
  }
}

export function createGame(players: Player[], settings: Settings): GameState {
  const round = makeRound(0, players, settings, [])
  return {
    settings,
    players: players.map((p) => ({ ...p, score: 0 })),
    round,
    phase: 'reveal',
    usedWords: [wordKey(round)],
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

/** Points are awarded once per round, to everyone who was on the winning side. */
export const SCORE = {
  civilianWin: 2,
  imposterWin: 3,
  /** Consolation when a caught imposter still names the word. */
  imposterGuess: 2,
  civilianWinDespiteGuess: 1,
} as const

function award(state: GameState, round: Round): Player[] {
  const gain = (id: string) => {
    const imposter = round.imposterIds.includes(id)
    if (round.outcome === 'imposters') return imposter ? SCORE.imposterWin : 0
    if (round.outcome === 'civilians') {
      if (round.imposterGuessedRight) {
        return imposter ? SCORE.imposterGuess : SCORE.civilianWinDespiteGuess
      }
      return imposter ? 0 : SCORE.civilianWin
    }
    return 0
  }
  return state.players.map((p) => ({ ...p, score: p.score + gain(p.id) }))
}

function finish(state: GameState, round: Round): GameState {
  return { ...state, players: award(state, round), round, phase: 'roundEnd' }
}

export const isLastRound = (state: GameState) =>
  state.round.index + 1 >= state.settings.rounds

// ---------------------------------------------------------------- reducer

export function reduce(state: GameState, action: Action): GameState {
  const { round } = state

  switch (action.type) {
    case 'revealNext': {
      const revealed = round.revealed + 1
      const done = revealed >= state.players.length
      return { ...state, round: { ...round, revealed }, phase: done ? 'discuss' : 'reveal' }
    }

    case 'toVote':
      return { ...state, phase: 'vote' }

    case 'eject':
      return { ...state, phase: 'ejected', round: { ...round, ejectedId: action.playerId } }

    case 'resolveEjection': {
      const alive = round.ejectedId
        ? round.alive.filter((id) => id !== round.ejectedId)
        : round.alive
      const next = { ...round, alive }
      const impostersLeft = aliveImposters(next).length
      const civiliansLeft = aliveCivilians(next).length

      if (impostersLeft === 0) {
        const caught = { ...next, outcome: 'civilians' as const }
        if (state.settings.lastChance) return { ...state, round: caught, phase: 'lastChance' }
        return finish(state, caught)
      }
      if (impostersLeft >= civiliansLeft) {
        return finish(state, { ...next, outcome: 'imposters' as const })
      }
      // Nobody has won yet: another clue pass with the survivors.
      return {
        ...state,
        phase: 'discuss',
        round: { ...next, pass: next.pass + 1, ejectedId: null },
      }
    }

    case 'lastChance':
      return finish(state, { ...round, imposterGuessedRight: action.correct })

    case 'endGame':
      return { ...state, phase: 'gameEnd' }

    case 'startRound':
      return {
        ...state,
        round: action.round,
        phase: 'reveal',
        usedWords: [...state.usedWords, wordKey(action.round)],
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
