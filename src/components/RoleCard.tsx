import { useEffect } from 'react'
import type { Translate } from '../game/i18n'
import { portraitFor, preloadRoleArt, ROLE_ART } from '../game/portraits'
import { Avatar } from './ui'

/**
 * The moment the game turns on: a face-down card with your name above it and
 * one button below. Pressing it flips the card to the artwork for your role.
 * Both roles use the same card back, so nobody can read the outcome from the
 * way the screen looked a second earlier.
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
  const portrait = portraitFor(name)

  return (
    <>
      <div className="who-plate">
        {portrait ? (
          <img className="portrait" src={portrait} alt="" />
        ) : (
          <Avatar name={name} size={52} />
        )}
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
              {imposter ? (
                <>
                  <span className="word alert">{t('youAreImposter')}</span>
                  <p>{t('imposterBlurb')}</p>
                  <span className="badge">
                    {category && !noHint
                      ? `${category.emoji} ${t('category')}: ${category.name}`
                      : `🚫 ${t('noHint')}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="eyebrow">{t('yourWord')}</span>
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
