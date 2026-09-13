import { useRef, useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import { LANG_LABEL, LANGS } from '../game/i18n'
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/state'
import { Mark } from '../components/Characters'
import { Avatar, Segmented, Sheet } from '../components/ui'
import { buzz } from '../hooks'

export function HomeScreen({
  t,
  lang,
  onLang,
  names,
  onNames,
  onNext,
}: {
  t: Translate
  lang: Lang
  onLang: (lang: Lang) => void
  names: string[]
  onNames: (names: string[]) => void
  onNext: () => void
}) {
  const [draft, setDraft] = useState('')
  const [rules, setRules] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const trimmed = draft.trim()
  const duplicate = names.some((n) => n.toLowerCase() === trimmed.toLowerCase())
  const canAdd = trimmed.length > 0 && !duplicate && names.length < MAX_PLAYERS

  const add = () => {
    if (!canAdd) return
    onNames([...names, trimmed])
    setDraft('')
    buzz()
    input.current?.focus()
  }

  const missing = MIN_PLAYERS - names.length

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="sr-only">{t('appName')}</h1>
        <Segmented
          label={t('language')}
          value={lang}
          onChange={onLang}
          options={LANGS.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
        />
      </div>

      <div className="hero">
        <Mark className="mark" />
        <h2>{t('appName')}</h2>
        <p>{t('tagline')}</p>
      </div>

      <div className="scroll">
        <div className="card">
          <div className="card-head">
            <h3>{t('players')}</h3>
            <span>
              {names.length}/{MAX_PLAYERS}
            </span>
          </div>

          <form
            className="name-row"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <input
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 16))}
              placeholder={t('playerNamePlaceholder')}
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t('playerNamePlaceholder')}
            />
            <button className="add" type="submit" disabled={!canAdd} aria-label={t('addPlayer')}>
              +
            </button>
          </form>

          {duplicate && trimmed.length > 0 && (
            <p className="hint warn" style={{ marginTop: 8 }}>
              {t('duplicateName')}
            </p>
          )}

          {names.length === 0 ? (
            <p className="empty">{t('noPlayersYet')}</p>
          ) : (
            <ul className="player-list" style={{ marginTop: 12 }}>
              {names.map((name) => (
                <li className="player-chip" key={name}>
                  <Avatar name={name} />
                  <span className="name">{name}</span>
                  <button
                    className="remove"
                    aria-label={t('removePlayer', { name })}
                    onClick={() => onNames(names.filter((n) => n !== name))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="actions">
        {missing > 0 && <p className="hint">{t('needMorePlayers', { n: MIN_PLAYERS })}</p>}
        <button className="btn btn-primary" disabled={missing > 0} onClick={onNext}>
          {t('next')}
        </button>
        <button className="btn btn-quiet" onClick={() => setRules(true)}>
          {t('howToPlay')}
        </button>
      </div>

      {rules && (
        <Sheet title={t('rulesTitle')} onClose={() => setRules(false)}>
          <ul className="rules">
            {(['rule1', 'rule2', 'rule3', 'rule4', 'rule5'] as const).map((key, i) => (
              <li key={key}>
                <b>{i + 1}</b>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost" onClick={() => setRules(false)}>
            {t('close')}
          </button>
        </Sheet>
      )}
    </div>
  )
}
