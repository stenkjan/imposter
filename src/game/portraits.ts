/**
 * Easter egg: drop a picture in `public/portraits/` and map the player's name
 * to it here. When someone types that name, their own face greets them above
 * the card instead of the coloured initials.
 *
 * Keys are compared lowercased and trimmed, so "Jan", "jan" and " JAN " all hit
 * the same entry.
 *
 *   'jan': '/portraits/jan.webp',
 */
export const PORTRAITS: Record<string, string> = {}

export function portraitFor(name: string): string | null {
  return PORTRAITS[name.trim().toLowerCase()] ?? null
}

/** The two role pictures, preloaded so the card flip never shows a blank face. */
export const ROLE_ART = {
  imposter: '/role-imposter.webp',
  civilian: '/role-civilian.webp',
} as const

let warmed = false
export function preloadRoleArt() {
  if (warmed || typeof Image === 'undefined') return
  warmed = true
  for (const src of Object.values(ROLE_ART)) new Image().src = src
}
