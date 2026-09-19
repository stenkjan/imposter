import { useEffect } from 'react'
import type { Translate } from '../game/i18n'
import { preloadRoleArt, ROLE_ART } from '../game/portraits'
import { Avatar } from './ui'

/**
 * The moment the game turns on: a face-down card with your name above it and
 * one button below. Pressing it flips the card to the artwork for your role.
 *
 * Face down, both cards are identical. Once open, the room behind the card
 * turns red for a civilian and stays black for an imposter — that colour is
 * visible from across the table, so the reveal is meant to be read over a
 * shoulder, not hidden from one.
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
      {/* Outside .flip-scene on purpose — see .stage-wash in styles.css. */}
      <div className="stage-wash" data-role={open && !imposter ? 'civilian' : 'none'} aria-hidden />

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
