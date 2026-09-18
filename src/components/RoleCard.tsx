import { useEffect } from 'react'
import type { Translate } from '../game/i18n'
import { preloadRoleArt, ROLE_ART } from '../game/portraits'
import { Avatar } from './ui'

/**
 * The moment the game turns on: a face-down card with your name above it and
 * one button below. Pressing it flips the card to the artwork for your role.
 *
 * Both sides are built to look the same from across the table: one card back,
 * the same frame and the same wash of colour over either picture, and a role
 * line in the same weight whichever it says. In a live round the glow off
 * somebody's screen was giving the game away long before they spoke.
 */
export function RoleCard({
  t,
  name,
  open,
  onOpen,
  imposter,
  word,
  category,
  noHint,
}: {
  t: Translate
  name: string
  open: boolean
  onOpen: () => void
  imposter: boolean
  /** The secret word; only ever passed for civilians. */
  word: string | null
  category: { emoji: string; name: string } | null
  noHint?: boolean
}) {
  useEffect(preloadRoleArt, [])

  return (
    <>
      <div className="who-plate">
        <Avatar name={name} size={56} />
        <span className="who-name">{name}</span>
      </div>

      <div className="flip-scene">
        <div className="flipper" data-open={open}>
          <button
            type="button"
            className="face back"
            onClick={onOpen}
            disabled={open}
            aria-hidden={open}
          >
            <span className="seal">?</span>
            <span className="back-label">{t('tapToReveal')}</span>
          </button>

          <div
            className={imposter ? 'face front imposter' : 'face front civilian'}
            aria-hidden={!open}
          >
            <img
              className="art"
              src={imposter ? ROLE_ART.imposter : ROLE_ART.civilian}
              alt=""
              draggable={false}
            />
            <div className="art-caption">
              <span className="role-line">
                {imposter ? t('youAreImposter') : t('civilian')}
              </span>
              {imposter ? (
                <>
                  <p>{t('imposterBlurb')}</p>
                  <span className="badge">
                    {category && !noHint
                      ? `${category.emoji} ${t('category')}: ${category.name}`
                      : `🚫 ${t('noHint')}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="word">{word}</span>
                  {category && (
                    <span className="badge">
                      {category.emoji} {category.name}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
