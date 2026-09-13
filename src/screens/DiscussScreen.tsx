import { useState } from 'react'
import type { Translate } from '../game/i18n'
import { playerById, type GameState } from '../game/state'
import { TopBar } from '../components/ui'
import { buzz, useCountdown } from '../hooks'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function DiscussScreen({
  t,
  state,
  onVote,
}: {
  t: Translate
  state: GameState
  onVote: () => void
}) {
  const { round, settings } = state
  // Starts by itself, like the online room does — one tap less, and the two
  // modes behave the same.
  const [running, setRunning] = useState(settings.timerSeconds > 0)
  const { remaining } = useCountdown(settings.timerSeconds, running, () => {
    setRunning(false)
    buzz([80, 60, 80])
  })

  const speakers = round.order.map((id) => playerById(state, id)!).filter(Boolean)
  const alive = speakers.filter((p) => round.alive.includes(p.id))
  const starter = alive[0]
  const over = settings.timerSeconds > 0 && remaining === 0

  return (
    <div className="screen">
      <TopBar
        title={t('discussion')}
        step={t('round', { n: round.index + 1, total: settings.rounds })}
      />

      <div className="hero" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 'clamp(24px, 7vw, 32px)' }}>
          {starter ? t('startsWith', { name: starter.name }) : t('discussion')}
        </h2>
        <p>{t('discussHint')}</p>
      </div>

      {settings.timerSeconds > 0 && (
        <div className="card">
          <div className="timer">
            <span className={remaining <= 10 ? 'clock low' : 'clock'}>
              {over ? t('timeUp') : mmss(remaining)}
            </span>
            <div className="bar">
              <span style={{ width: `${(remaining / settings.timerSeconds) * 100}%` }} />
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => {
              buzz()
              setRunning((r) => !r)
            }}
            disabled={over}
          >
            {running ? t('pause') : t('resume')}
          </button>
        </div>
      )}

      <div className="scroll">
        <div className="card">
          <div className="card-head">
            <h3>{t('clueOrder')}</h3>
            <span>
              {alive.length}/{state.players.length} {t('stillIn').toLowerCase()}
            </span>
          </div>
          <ul className="order-list">
            {speakers.map((p) => {
              const gone = !round.alive.includes(p.id)
              const position = alive.indexOf(p)
              return (
                <li
                  key={p.id}
                  className={`order-item${gone ? ' gone' : ''}${position === 0 ? ' first' : ''}`}
                >
                  <span className="num">{gone ? '×' : position + 1}</span>
                  <span className="name">{p.name}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={onVote}>
          {t('toVote')}
        </button>
      </div>
    </div>
  )
}
