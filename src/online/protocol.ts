import type { Lang } from '../game/i18n'
import type { Phase, Settings } from '../game/state'

/**
 * The wire format between the phone and the room, shared by client and API so
 * a field can never drift apart. Everything here is already redacted for one
 * specific player: the imposter's word is absent from their own view, and the
 * full list of imposters only appears once the round is over.
 */

export type PlayerView = {
  id: string
  name: string
  score: number
  online: boolean
  ready: boolean
  voted: boolean
}

export type RoundView = {
  index: number
  rounds: number
  phase: Phase
  pass: number
  alive: string[]
  order: string[]
  /** The secret word — null while you are the imposter and the round runs. */
  word: string | null
  category: { emoji: string; name: string } | null
  imposter: boolean
  ejectedId: string | null
  /** Only the ejected player's role is revealed, never the others'. */
  ejectedWasImposter: boolean | null
  /** Filled in at the end of a round, null while it is still running. */
  imposterIds: string[] | null
  outcome: 'civilians' | 'imposters' | null
  imposterGuessedRight: boolean
  myVote: string | null
}

export type RoomView = {
  code: string
  lang: Lang
  settings: Settings
  players: PlayerView[]
  hostId: string
  youId: string
  stage: 'lobby' | 'game'
  round: RoundView | null
  version: number
}

export type ClientAction =
  /** Mark yourself done looking at your card. */
  | { type: 'ready' }
  | { type: 'vote'; targetId: string | null }
  // Host-only, below: pacing the table is one person's job.
  | { type: 'settings'; settings: Settings }
  | { type: 'lang'; lang: Lang }
  | { type: 'start' }
  | { type: 'toVote' }
  | { type: 'resolve' }
  | { type: 'lastChance'; correct: boolean }
  | { type: 'nextRound' }
  | { type: 'restart' }
  | { type: 'kick'; playerId: string }

export type Credentials = { code: string; playerId: string; token: string }

export const ROOM_CODE_LENGTH = 4
/** No I/O/0/1 — they get misread when someone reads the code out loud. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const isValidCode = (code: string) =>
  code.length === ROOM_CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c))
