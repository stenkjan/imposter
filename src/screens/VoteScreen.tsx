import { useState } from 'react'
import type { Translate } from '../game/i18n'
import { playerById, type GameState } from '../game/state'
import { Avatar, TopBar } from '../components/ui'
import { buzz } from '../hooks'

export function VoteScreen({
  t,
  state,
  onEject,
  onBack,
}: {
  t: Translate
  state: GameState
  onEject: (playerId: string | null) => void
  onBack: () => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const alive = state.round.alive.map((id) => playerById(state, id)!).filter(Boolean)
  const name = picked ? (playerById(state, picked)?.name ?? '') : ''

  return (
    <div className="screen">
      <TopBar
        title={t('voteTitle')}
        onBack={onBack}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />

      <p className="hint">{t('voteHint')}</p>

      <div className="scroll">
        <ul className="vote-list">
          {alive.map((p) => (
            <li key={p.id}>
              <button
                className="vote-btn"
                aria-pressed={picked === p.id}
                onClick={() => {
                  buzz()
                  setPicked((current) => (current === p.id ? null : p.id))
                }}
              >
                <Avatar name={p.name} size={34} />
                <span className="name">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="actions">
        <button
          className="btn btn-primary"
          disabled={!picked}
          onClick={() => {
            buzz([14, 40, 14])
            onEject(picked)
          }}
        >
          {picked ? t('eject', { name }) : t('pickSomeone')}
        </button>
        <button className="btn btn-quiet" onClick={() => onEject(null)}>
          {t('nobody')}
        </button>
      </div>
    </div>
  )
}
