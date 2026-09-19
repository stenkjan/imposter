import { useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import { isImposter, roundCategory, roundWord, type GameState } from '../game/state'
import { RoleCard } from '../components/RoleCard'
import { TopBar } from '../components/ui'
import { buzz } from '../hooks'

export function RevealScreen({
  t,
  lang,
  state,
  onNext,
}: {
  t: Translate
  lang: Lang
  state: GameState
  onNext: () => void
}) {
  const [open, setOpen] = useState(false)
  const player = state.players[state.round.revealed]
  const imposter = isImposter(state.round, player.id)
  const category = roundCategory(state.round)
  const hint = state.settings.imposterHint

  return (
    <div className="screen">
      <TopBar
        title={t('appName')}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />

      <RoleCard
        t={t}
        name={player.name}
        open={open}
        onOpen={() => {
          buzz()
          setOpen(true)
        }}
        imposter={imposter}
        word={imposter ? null : roundWord(state.round)[lang]}
        category={
          imposter && hint === 'none' ? null : { emoji: category.emoji, name: category.name[lang] }
        }
        near={imposter && hint === 'near' ? roundWord(state.round).near[lang] : null}
      />

      <div className="actions">
        {open ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              setOpen(false)
              onNext()
            }}
          >
            {t('gotIt')}
          </button>
        ) : (
          <>
            <p className="hint">{t('passToHint')}</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                buzz()
                setOpen(true)
              }}
            >
              {t('revealButton')}
            </button>
            <p className="hint">
              {state.round.revealed + 1} / {state.players.length}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
