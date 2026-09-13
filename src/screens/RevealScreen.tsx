import { useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import { isImposter, roundCategory, roundWord, type GameState } from '../game/state'
import { Crew } from '../components/Characters'
import { Avatar, TopBar } from '../components/ui'
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

  const advance = () => {
    setOpen(false)
    onNext()
  }

  return (
    <div className="screen">
      <TopBar
        title={t('appName')}
        step={t('round', { n: state.round.index + 1, total: state.settings.rounds })}
      />

      {!open ? (
        <>
          <div className="pass">
            <Avatar name={player.name} size={64} />
            <div className="who">{t('passTo', { name: player.name })}</div>
            <p>{t('passToHint')}</p>
          </div>
          <button
            className="tap-card"
            onClick={() => {
              buzz()
              setOpen(true)
            }}
          >
            <span className="seal" aria-hidden="true">
              🤫
            </span>
            {t('tapToReveal')}
          </button>
          <div className="actions">
            <p className="hint">
              {state.round.revealed + 1} / {state.players.length}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className={imposter ? 'role-card imposter' : 'role-card civilian'}>
            <Crew tone={imposter ? 'imposter' : 'civilian'} size={96} />
            {imposter ? (
              <>
                <span className="eyebrow">{player.name}</span>
                <span className="word alert">{t('youAreImposter')}</span>
                <p>{t('imposterBlurb')}</p>
                <span className="badge">
                  {state.settings.hintForImposter
                    ? `${category.emoji} ${t('category')}: ${category.name[lang]}`
                    : `🚫 ${t('noHint')}`}
                </span>
              </>
            ) : (
              <>
                <span className="eyebrow">{t('yourWord')}</span>
                <span className="word">{roundWord(state.round)[lang]}</span>
                <span className="badge">
                  {category.emoji} {category.name[lang]}
                </span>
              </>
            )}
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={advance}>
              {t('gotIt')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
