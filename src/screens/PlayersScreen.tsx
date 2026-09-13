import { useRef, useState } from 'react'
import type { Translate } from '../game/i18n'
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/state'
import { Avatar, TopBar } from '../components/ui'
import { buzz } from '../hooks'

export function PlayersScreen({
  t,
  names,
  onNames,
  onBack,
  onNext,
}: {
  t: Translate
  names: string[]
  onNames: (names: string[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const [draft, setDraft] = useState('')
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
      <TopBar title={t('players')} onBack={onBack} step={`${names.length}/${MAX_PLAYERS}`} />

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

      {duplicate && trimmed.length > 0 && <p className="hint warn">{t('duplicateName')}</p>}

      <div className="scroll">
        {names.length === 0 ? (
          <p className="empty">{t('noPlayersYet')}</p>
        ) : (
          <ul className="player-list">
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

      <div className="actions">
        {missing > 0 && <p className="hint">{t('needMorePlayers', { n: MIN_PLAYERS })}</p>}
        <button className="btn btn-primary" disabled={missing > 0} onClick={onNext}>
          {t('next')}
        </button>
      </div>
    </div>
  )
}
