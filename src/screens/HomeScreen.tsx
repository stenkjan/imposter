import { useState } from 'react'
import type { Lang, Translate } from '../game/i18n'
import { LANG_LABEL, LANGS } from '../game/i18n'
import { Crew, Mark } from '../components/Characters'
import { Segmented, Sheet } from '../components/ui'

export function HomeScreen({
  t,
  lang,
  onLang,
  onLocal,
  onOnline,
}: {
  t: Translate
  lang: Lang
  onLang: (lang: Lang) => void
  onLocal: () => void
  onOnline: () => void
}) {
  const [rules, setRules] = useState(false)

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

      <div className="scroll" style={{ justifyContent: 'center' }}>
        <button className="mode-card" onClick={onLocal}>
          <span className="glyph" aria-hidden="true">
            📱
          </span>
          <span className="copy">
            <strong>{t('modeSamePhone')}</strong>
            <small>{t('modeSamePhoneHint')}</small>
          </span>
        </button>

        <button className="mode-card accent" onClick={onOnline}>
          <span className="glyph crew" aria-hidden="true">
            <Crew tone="imposter" size={34} />
            <Crew tone="civilian" size={34} />
          </span>
          <span className="copy">
            <strong>{t('modeOwnPhones')}</strong>
            <small>{t('modeOwnPhonesHint')}</small>
          </span>
        </button>
      </div>

      <div className="actions">
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
