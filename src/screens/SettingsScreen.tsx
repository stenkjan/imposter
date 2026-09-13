import type { Lang, Translate } from '../game/i18n'
import { CATEGORIES } from '../game/words'
import { maxImposters, recommendedImposters, type Settings } from '../game/state'
import { Segmented, Toggle, TopBar } from '../components/ui'
import { IconCheck, IconPlay } from '../components/icons'

const ROUND_CHOICES = [1, 3, 5, 8]
const TIMER_CHOICES = [0, 60, 90, 120, 180]

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function SettingsScreen({
  t,
  lang,
  playerCount,
  settings,
  onSettings,
  onBack,
  onStart,
  startLabel,
  startIcon = 'play',
  startDisabled = false,
  startHint,
}: {
  t: Translate
  lang: Lang
  playerCount: number
  settings: Settings
  onSettings: (next: Settings) => void
  onBack: () => void
  onStart: () => void
  /** Im Online-Raum schliesst der Knopf nur die Einstellungen. */
  startLabel?: string
  startIcon?: 'play' | 'check'
  startDisabled?: boolean
  startHint?: string
}) {
  const cap = maxImposters(playerCount)
  const imposterChoices = Array.from({ length: cap }, (_, i) => i + 1)
  const imposters = Math.min(settings.imposters, cap)
  const patch = (next: Partial<Settings>) => onSettings({ ...settings, ...next, imposters })

  const allSelected = settings.categoryIds.length === CATEGORIES.length

  return (
    <div className="screen">
      <TopBar title={t('settings')} onBack={onBack} />

      <div className="scroll">
        <div className="card">
          <div className="setting">
            <div className="setting-label">
              <strong>{t('imposterCount')}</strong>
              <small>
                {t('imposterCountHint', {
                  n: Math.min(recommendedImposters(playerCount), cap),
                  p: playerCount,
                })}
              </small>
            </div>
            <Segmented
              accent
              label={t('imposterCount')}
              value={imposters}
              onChange={(v) => patch({ imposters: v })}
              options={imposterChoices.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
        </div>

        <div className="card">
          <Toggle
            checked={settings.hintForImposter}
            onChange={(v) => patch({ hintForImposter: v })}
            title={t('imposterHint')}
            description={settings.hintForImposter ? t('imposterHintOn') : t('imposterHintOff')}
          />
        </div>

        <div className="card">
          <div className="setting">
            <div className="setting-label">
              <strong>{t('rounds')}</strong>
              <small>{t('roundsHint')}</small>
            </div>
            <Segmented
              label={t('rounds')}
              value={settings.rounds}
              onChange={(v) => patch({ rounds: v })}
              options={ROUND_CHOICES.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>

          <div className="setting">
            <div className="setting-label">
              <strong>{t('timer')}</strong>
              <small>{t('timerHint')}</small>
            </div>
            <Segmented
              label={t('timer')}
              value={settings.timerSeconds}
              onChange={(v) => patch({ timerSeconds: v })}
              options={TIMER_CHOICES.map((n) => ({
                value: n,
                label: n === 0 ? t('timerOff') : clock(n),
              }))}
            />
          </div>
        </div>

        <div className="card">
          <Toggle
            checked={settings.lastChance}
            onChange={(v) => patch({ lastChance: v })}
            title={t('lastChance')}
            description={t('lastChanceHint')}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{t('categories')}</h3>
            <button
              className="btn-quiet"
              style={{ minHeight: 0, fontSize: 13 }}
              // Only ever adds. A button labelled "Alle" that silently drops
              // nine categories would be a trap; narrowing is done per chip.
              disabled={allSelected}
              onClick={() => patch({ categoryIds: CATEGORIES.map((c) => c.id) })}
            >
              {t('selectAll')}
            </button>
          </div>
          <div className="chips">
            {CATEGORIES.map((c) => {
              const on = settings.categoryIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on
                      ? settings.categoryIds.filter((id) => id !== c.id)
                      : [...settings.categoryIds, c.id]
                    if (next.length) patch({ categoryIds: next })
                  }}
                >
                  <span aria-hidden="true">{c.emoji}</span>
                  {c.name[lang]}
                </button>
              )
            })}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            {t('categoriesHint', { n: settings.categoryIds.length })}
          </p>
        </div>
      </div>

      <div className="actions">
        {startHint && <p className="hint">{startHint}</p>}
        <button className="btn btn-go" disabled={startDisabled} onClick={onStart}>
          {startIcon === 'check' ? <IconCheck /> : <IconPlay />}
          {startLabel ?? t('startGame')}
        </button>
      </div>
    </div>
  )
}
