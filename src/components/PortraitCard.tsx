import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Translate } from '../game/i18n'
import { portraitFor } from '../game/portraits'

/**
 * Tapping a face anywhere in the app blows it up to a full card — the same
 * shape the role artwork gets in the game, with the name and, where there is
 * one, the score underneath.
 *
 * It rides on context rather than props: an avatar appears in seven different
 * lists, and none of them should have to know that this exists.
 */

export type PortraitSubject = {
  name: string
  points?: number | null
  note?: string
}

const PortraitContext = createContext<((subject: PortraitSubject) => void) | null>(null)

/** Null outside a provider, which is what makes an avatar plain there. */
export const usePortraitCard = () => useContext(PortraitContext)

export function PortraitProvider({ t, children }: { t: Translate; children: ReactNode }) {
  const [subject, setSubject] = useState<PortraitSubject | null>(null)

  return (
    <PortraitContext.Provider value={setSubject}>
      {children}
      {subject && <PortraitSheet t={t} subject={subject} onClose={() => setSubject(null)} />}
    </PortraitContext.Provider>
  )
}

function PortraitSheet({
  t,
  subject,
  onClose,
}: {
  t: Translate
  subject: PortraitSubject
  onClose: () => void
}) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="portrait-card" role="dialog" aria-modal="true" aria-label={subject.name}>
        <button className="portrait-shot" onClick={onClose} aria-label={t('close')}>
          <img src={portraitFor(subject.name)} alt="" draggable={false} />
        </button>
        <div className="art-caption">
          <span className="word">{subject.name}</span>
          {typeof subject.points === 'number' && (
            <span className="badge">
              {subject.points} {t('pointsShort')}
            </span>
          )}
          {subject.note && <p>{subject.note}</p>}
        </div>
      </div>
    </>
  )
}
