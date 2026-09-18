import { useEffect, useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import type { Credentials } from '../online/protocol'
import { ROOM_CODE_LENGTH } from '../online/protocol'
import { ApiError, createRoom, joinRoom, peekRoom, type RoomPeek } from '../online/client'
import { Crew } from '../components/Characters'
import { Segmented, TopBar } from '../components/ui'
import { buzz } from '../hooks'

type Tab = 'join' | 'create'

const ERRORS: Record<string, string> = {
  'no-such-room': 'roomNotFound',
  'bad-code': 'roomNotFound',
  'room-full': 'roomFull',
  'already-started': 'alreadyStarted',
  'name-taken': 'nameInUse',
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
  const [peek, setPeek] = useState<RoomPeek | null>(null)

  // As soon as the code is complete, show who is in there. A running game is
  // no longer a closed door: it is an invitation to take your old seat back.
  useEffect(() => {
    setPeek(null)
    if (tab !== 'join' || code.length !== ROOM_CODE_LENGTH) return
    let cancelled = false
    void peekRoom(code).then((found) => {
      if (!cancelled) setPeek(found)
    })
    return () => {
      cancelled = true
    }
  }, [code, tab])

  const running = peek?.stage === 'game'
  const seatFor = (value: string) =>
    peek?.players.find((p) => p.name.toLowerCase() === value.trim().toLowerCase())

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

        {peek && peek.players.length > 0 && (
          <p className="hint">
            {t('roomOccupants', { names: peek.players.map((p) => p.name).join(', ') })}
          </p>
        )}
        {running && !seatFor(name) && <p className="hint">{t('rejoinHint')}</p>}
        {error && <p className="hint warn">{t(error as never)}</p>}
      </div>

      <div className="actions">
        <button className="btn btn-go" disabled={!ready} onClick={() => void go()}>
          {busy
            ? `${t('connecting')}…`
            : tab === 'create'
              ? t('createRoom')
              : seatFor(name)
                ? t('rejoin')
                : t('joinRoom')}
        </button>
      </div>
    </div>
  )
}
