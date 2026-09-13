import { useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import type { Credentials } from '../online/protocol'
import { ROOM_CODE_LENGTH } from '../online/protocol'
import { ApiError, createRoom, joinRoom } from '../online/client'
import { Crew } from '../components/Characters'
import { Segmented, TopBar } from '../components/ui'
import { buzz } from '../hooks'

type Tab = 'join' | 'create'

const ERRORS: Record<string, string> = {
  'no-such-room': 'roomNotFound',
  'bad-code': 'roomNotFound',
  'room-full': 'roomFull',
  'already-started': 'alreadyStarted',
  'name-taken': 'duplicateName',
  'storage-unconfigured': 'storageUnavailable',
}

export function OnlineEntryScreen({
  t,
  lang,
  presetCode,
  lastName,
  onBack,
  onEntered,
}: {
  t: Translate
  lang: Lang
  presetCode: string
  lastName: string
  onBack: () => void
  onEntered: (creds: Credentials, name: string) => void
}) {
  const [tab, setTab] = useState<Tab>(presetCode ? 'join' : 'create')
  const [name, setName] = useState(lastName)
  const [code, setCode] = useState(presetCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const ready =
    trimmed.length > 0 && (tab === 'create' || code.length === ROOM_CODE_LENGTH) && !busy

  const go = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      buzz()
      const creds =
        tab === 'create' ? await createRoom(trimmed, lang) : await joinRoom(code, trimmed)
      onEntered(creds, trimmed)
    } catch (e) {
      const key = e instanceof ApiError ? ERRORS[e.message] : undefined
      setError(key ?? 'somethingWentWrong')
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <TopBar title={t('modeOwnPhones')} onBack={onBack} />

      <div className="hero" style={{ paddingBlock: 4 }}>
        <div className="characters">
          <Crew tone="civilian" size={54} />
          <Crew tone="imposter" size={66} />
          <Crew tone="civilian" size={54} />
        </div>
      </div>

      <Segmented
        label={t('modeOwnPhones')}
        value={tab}
        onChange={(next) => {
          setTab(next)
          setError(null)
        }}
        options={[
          { value: 'create' as Tab, label: t('tabCreate') },
          { value: 'join' as Tab, label: t('tabJoin') },
        ]}
      />

      <div className="scroll">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault()
            void go()
          }}
        >
          {tab === 'join' && (
            <div className="setting">
              <div className="setting-label">
                <strong>{t('roomCode')}</strong>
              </div>
              <input
                className="code-input"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, ROOM_CODE_LENGTH),
                  )
                }
                placeholder={t('enterCode')}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('roomCode')}
              />
            </div>
          )}

          <div className="setting">
            <div className="setting-label">
              <strong>{t('yourName')}</strong>
            </div>
            <div className="name-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 16))}
                placeholder={t('playerNamePlaceholder')}
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('yourName')}
              />
            </div>
          </div>

          <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
        </form>

        {error && <p className="hint warn">{t(error as never)}</p>}
      </div>

      <div className="actions">
        <button className="btn btn-go" disabled={!ready} onClick={() => void go()}>
          {busy ? `${t('connecting')}…` : tab === 'create' ? t('createRoom') : t('joinRoom')}
        </button>
      </div>
    </div>
  )
}
