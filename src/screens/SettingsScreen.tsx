import type { Lang, Translate } from '../game/i18n'
import { CATEGORIES } from '../game/words'
import {
  maxImposters,
  recommendedImposters,
  type ScoreRules,
  type Settings,
} from '../game/state'
import type { OrderMode } from '../game/fairness'
import { Segmented, Stepper, Toggle, TopBar } from '../components/ui'
import { IconCheck, IconPlay } from '../components/icons'

const ROUND_CHOICES = [1, 3, 5, 8]
/** One to five minutes of thinking time, or none at all. */
const TIMER_CHOICES = [0, 60, 120, 180, 240, 300]
const LEVELS = [0, 0.6, 1]
const EDGE_LEVELS = [0, 0.5, 0.8]

const POINT_RULES: Array<{ key: keyof ScoreRules; title: string; hint: string }> = [
  { key: 'voteCorrect', title: 'ptVoteCorrect', hint: 'ptVoteCorrectHint' },
  { key: 'imposterSurvive', title: 'ptImposterSurvive', hint: 'ptImposterSurviveHint' },
  { key: 'imposterGuess', title: 'ptImposterGuess', hint: 'ptImposterGuessHint' },
  { key: 'clockSurvived', title: 'ptClockSurvived', hint: 'ptClockSurvivedHint' },
  { key: 'civilianWin', title: 'ptCivilianWin', hint: 'ptCivilianWinHint' },
  { key: 'imposterWin', title: 'ptImposterWin', hint: 'ptImposterWinHint' },
]

const ORDER_HINT: Record<OrderMode, 'orderRotateHint' | 'orderLobbyHint' | 'orderRandomHint'> = {
  rotate: 'orderRotateHint',
  lobby: 'orderLobbyHint',
  random: 'orderRandomHint',
}

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
  const setPoints = (next: Partial<ScoreRules>) =>
    patch({ points: { ...settings.points, ...next } })

  const allSelected = settings.categoryIds.length === CATEGORIES.length
  const nearest = (choices: number[], value: number) =>
    choices.reduce((best, c) => (Math.abs(c - value) < Math.abs(best - value) ? c : best), choices[0])

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
              value={nearest(TIMER_CHOICES, settings.timerSeconds)}
              onChange={(v) => patch({ timerSeconds: v })}
              options={TIMER_CHOICES.map((n) => ({
                value: n,
                label: n === 0 ? t('timerOff') : `${n / 60}m`,
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

        {/* Die Stellschrauben gegen den Zufall, der zu oft dieselbe Person trifft. */}
        <div className="card">
          <div className="setting">
            <div className="setting-label">
              <strong>{t('order')}</strong>
              <small>{t(ORDER_HINT[settings.orderMode])}</small>
            </div>
            <Segmented
              label={t('order')}
              value={settings.orderMode}
              onChange={(v) => patch({ orderMode: v })}
              options={[
                { value: 'rotate' as OrderMode, label: t('orderRotate') },
                { value: 'lobby' as OrderMode, label: t('orderLobby') },
                { value: 'random' as OrderMode, label: t('orderRandom') },
              ]}
            />
          </div>

          <div className="setting">
            <div className="setting-label">
              <strong>{t('fairness')}</strong>
              <small>{t('fairnessHint')}</small>
            </div>
            <Segmented
              label={t('fairness')}
              value={nearest(LEVELS, settings.imposterFairness)}
              onChange={(v) => patch({ imposterFairness: v })}
              options={[
                { value: LEVELS[0], label: t('levelOff') },
                { value: LEVELS[1], label: t('levelMid') },
                { value: LEVELS[2], label: t('levelHigh') },
              ]}
            />
          </div>

          <div className="setting">
            <div className="setting-label">
              <strong>{t('edges')}</strong>
              <small>{t('edgesHint')}</small>
            </div>
            <Segmented
              label={t('edges')}
              value={nearest(EDGE_LEVELS, settings.edgeAvoidance)}
              onChange={(v) => patch({ edgeAvoidance: v })}
              options={[
                { value: EDGE_LEVELS[0], label: t('levelOff') },
                { value: EDGE_LEVELS[1], label: '50 %' },
                { value: EDGE_LEVELS[2], label: '80 %' },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{t('scoring')}</h3>
            <span>{t('pointsShort')}</span>
          </div>
          <p className="hint" style={{ textAlign: 'left', marginBottom: 4 }}>
            {t('scoringHint')}
          </p>
          {POINT_RULES.map((rule) => (
            <Stepper
              key={rule.key}
              value={settings.points[rule.key]}
              onChange={(v) => setPoints({ [rule.key]: v })}
              title={t(rule.title as never)}
              description={t(rule.hint as never)}
              offLabel={t('off')}
            />
          ))}
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
