import { useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import {
  isImposter,
  playerById,
  roundCategory,
  roundWord,
  standings,
  winners,
  type GameState,
} from '../game/state'
import { Crew } from '../components/Characters'
import { LeaderboardSheet } from '../components/LeaderboardSheet'
import { Avatar, TopBar } from '../components/ui'

function ScoreList({
  state,
  t,
  earned,
}: {
  state: GameState
  t: Translate
  earned?: Record<string, number> | null
}) {
  const table = standings(state.players)
  const top = table[0]?.score ?? 0
  // Only crown an outright leader — a four-way tie in gold reads as noise.
  const soleLeader = top > 0 && table.filter((p) => p.score === top).length === 1
  return (
    <ul className="score-list">
      {table.map((p, i) => (
        <li key={p.id} className={soleLeader && p.score === top ? 'score-row lead' : 'score-row'}>
          <span className="rank">{i + 1}</span>
          <Avatar name={p.name} size={30} points={p.score} />
          <span className="name">{p.name}</span>
          {earned?.[p.id] ? <span className="gain">+{earned[p.id]}</span> : null}
          <span className="pts">
            {p.score}
            <small>{t('pointsShort')}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

function WordReveal({ state, lang, t }: { state: GameState; lang: Lang; t: Translate }) {
  const category = roundCategory(state.round)
  return (
    <div className="reveal-word">
      <small>{t('theWordWas')}</small>
      <strong>{roundWord(state.round)[lang]}</strong>
      <p className="hint" style={{ marginTop: 4 }}>
        {category.emoji} {category.name[lang]}
      </p>
    </div>
  )
}

export function EjectedScreen({
  t,
  state,
  onNext,
}: {
  t: Translate
  state: GameState
  onNext: () => void
}) {
  const ejected = playerById(state, state.round.ejectedId)
  const caught = ejected ? isImposter(state.round, ejected.id) : false

  return (
    <div className="screen">
      <TopBar
        title={t('voteTitle')}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />
      <div className="verdict">
        <Crew tone={!ejected ? 'neutral' : caught ? 'imposter' : 'civilian'} size={110} />
        {ejected ? (
          <>
            <h2>{ejected.name}</h2>
            <span className={caught ? 'tag good' : 'tag bad'}>
              {caught ? t('wasImposter') : t('wasCivilian')}
            </span>
          </>
        ) : (
          <h2>{t('nobodyEjected')}</h2>
        )}
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={onNext}>
          {t('next')}
        </button>
      </div>
    </div>
  )
}

/**
 * The vote settled nothing and the round goes on — but how it goes on is the
 * table's call: straight into another vote, or another lap of clues first.
 * The clock does not care either way, it keeps running.
 */
export function StandoffScreen({
  t,
  state,
  onContinue,
}: {
  t: Translate
  state: GameState
  onContinue: (as: 'discuss' | 'vote') => void
}) {
  return (
    <div className="screen">
      <TopBar
        title={t('standoffTitle')}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />
      <div className="verdict">
        <Crew tone="neutral" size={104} />
        <h2>{t('standoffTitle')}</h2>
        <p className="hint">{t('standoffBody')}</p>
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={() => onContinue('discuss')}>
          {t('newWordRound')}
        </button>
        <button className="btn btn-go" onClick={() => onContinue('vote')}>
          {t('voteAgain')}
        </button>
      </div>
    </div>
  )
}

export function LastChanceScreen({
  t,
  state,
  onResult,
}: {
  t: Translate
  state: GameState
  onResult: (correct: boolean) => void
}) {
  const names = state.round.imposterIds
    .map((id) => playerById(state, id)?.name)
    .filter(Boolean)
    .join(' & ')

  return (
    <div className="screen">
      <TopBar
        title={t('appName')}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />
      <div className="verdict">
        <Crew tone="imposter" size={110} />
        <h2>{t('lastChanceTitle')}</h2>
        <p className="hint" style={{ fontSize: 15 }}>
          {t('lastChanceBody', { names })}
        </p>
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={() => onResult(true)}>
          {t('guessedRight')}
        </button>
        <button className="btn btn-go" onClick={() => onResult(false)}>
          {t('guessedWrong')}
        </button>
      </div>
    </div>
  )
}

export function RoundEndScreen({
  t,
  lang,
  state,
  isLast,
  onNext,
}: {
  t: Translate
  lang: Lang
  state: GameState
  isLast: boolean
  onNext: () => void
}) {
  const impostersWon = state.round.outcome === 'imposters'
  const imposterNames = state.round.imposterIds
    .map((id) => playerById(state, id)?.name)
    .filter(Boolean)
    .join(', ')

  return (
    <div className="screen">
      <TopBar
        title={t('appName')}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />

      <div className="verdict" style={{ flex: 'none', paddingBlock: 8 }}>
        <Crew tone={impostersWon ? 'imposter' : 'civilian'} size={92} />
        <h2>{impostersWon ? t('impostersWin') : t('civiliansWin')}</h2>
      </div>

      <div className="scroll">
        <WordReveal state={state} lang={lang} t={t} />
        <div className="card">
          <div className="card-head">
            <h3>{state.round.imposterIds.length > 1 ? t('impostersWere') : t('imposterWas')}</h3>
            <span>{imposterNames}</span>
          </div>
          <ScoreList state={state} t={t} earned={state.round.earned} />
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={onNext}>
          {isLast ? t('seeScores') : t('nextRound')}
        </button>
      </div>
    </div>
  )
}

export function GameEndScreen({
  t,
  state,
  onPlayAgain,
  onNewLineup,
}: {
  t: Translate
  state: GameState
  onPlayAgain: () => void
  onNewLineup: () => void
}) {
  const [board, setBoard] = useState(false)
  const top = winners(state.players)
  const title = top.length === 1 ? t('winnerIs', { name: top[0].name }) : t('itIsATie')

  return (
    <div className="screen">
      <TopBar title={t('finalTitle')} />
      <div className="hero" style={{ gap: 8 }}>
        <div className="characters">
          <Crew tone="civilian" size={62} />
          <Crew tone="imposter" size={78} />
          <Crew tone="civilian" size={62} />
        </div>
        <h2 style={{ fontSize: 'clamp(24px, 7vw, 32px)' }}>{title}</h2>
      </div>

      <div className="scroll">
        <div className="card">
          <ScoreList state={state} t={t} />
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-go" onClick={onPlayAgain}>
          {t('playAgain')}
        </button>
        <button className="btn btn-quiet" onClick={() => setBoard(true)}>
          {t('leaderboard')}
        </button>
        <button className="btn btn-quiet" onClick={onNewLineup}>
          {t('newLineup')}
        </button>
      </div>

      {board && <LeaderboardSheet t={t} onClose={() => setBoard(false)} />}
    </div>
  )
}
