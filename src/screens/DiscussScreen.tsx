import type { Translate } from '../game/i18n'
import { playerById, type Action, type GameState } from '../game/state'
import { TopBar } from '../components/ui'
import { buzz, useDeadline } from '../hooks'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function DiscussScreen({
  t,
  state,
  dispatch,
  onVote,
}: {
  t: Translate
  state: GameState
  dispatch: (action: Action) => void
  onVote: () => void
}) {
  const { round, settings } = state
  // The same clock the online room uses: one per word round, set when the
  // discussion first started, and it does not rewind for a second lap.
  const remaining = useDeadline(round.deadlineAt, round.pausedAt, () =>
    dispatch({ type: 'expireClock' }),
  )
  const paused = round.pausedAt !== null
  const over = round.clockExpired || remaining === 0

  const speakers = round.order.map((id) => playerById(state, id)!).filter(Boolean)
  const alive = speakers.filter((p) => round.alive.includes(p.id))
  const starter = alive[0]

  return (
    <div className="screen">
      <TopBar
        title={t('discussion')}
        step={
          round.pass > 1
            ? t('wordRoundCount', { n: round.pass })
            : t('round', { n: round.index + 1, total: settings.rounds })
        }
      />

      <div className="hero" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 'clamp(24px, 7vw, 32px)' }}>
          {starter ? t('startsWith', { name: starter.name }) : t('discussion')}
        </h2>
        <p>{t('discussHint')}</p>
      </div>

      {remaining !== null && (
        <div className="card">
          <div className="timer">
            <span className={remaining <= 10 && !over ? 'clock low' : 'clock'}>
              {over ? t('timeUp') : mmss(remaining)}
            </span>
            <div className="bar">
              <span
                style={{ width: `${Math.min(100, (remaining / Math.max(settings.timerSeconds, 1)) * 100)}%` }}
              />
            </div>
          </div>
          {!over && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12 }}
              onClick={() => {
                buzz()
                dispatch({ type: paused ? 'resumeClock' : 'pauseClock', at: Date.now() })
              }}
            >
              {paused ? t('resume') : t('pause')}
            </button>
          )}
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
