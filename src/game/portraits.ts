/**
 * Faces for the people who actually play this. A name is matched broadly:
 * case, umlauts and punctuation are ignored, and only the first token counts,
 * so "Jan", "JAN", "Jan-Andre" and "jan s." all land on the same picture while
 * "Janine" stays a stranger.
 *
 * Everyone else gets one of the two guest portraits, picked by a name
 * heuristic. To give a newcomer their own face: drop a square WebP into
 * `public/portraits/` and add their spellings to ALIASES below.
 */

const PORTRAIT_DIR = '/portraits'

/** Every spelling that should land on a given picture. */
const ALIASES: Record<string, readonly string[]> = {
  jan: ['jan'],
  eddy: ['eddy', 'eddi', 'eddie', 'edi', 'ed', 'eduard', 'edward', 'emmeram', 'emme'],
  matthias: ['matthias', 'mathias', 'matze', 'matti', 'matthi', 'voldi', 'voldemar'],
  marco: ['marco', 'marko'],
  gabriel: ['gabriel', 'gabe'],
  lara: ['lara'],
  tobias: ['tobias', 'tobi', 'tobsi', 'toby'],
}

const GUEST_MALE = 'guest-m'
const GUEST_FEMALE = 'guest-f'

const BY_ALIAS = new Map<string, string>()
for (const [file, spellings] of Object.entries(ALIASES)) {
  for (const spelling of spellings) BY_ALIAS.set(spelling, file)
}

/** Lowercase, strip accents, drop everything that is not a letter. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

const firstToken = (name: string) => name.trim().split(/[\s._-]+/)[0] ?? ''

// ---------------------------------------------------------------- guessing

/**
 * Only decides which of two stock portraits a stranger gets, nothing else.
 * German and English first names ending in -a are overwhelmingly female, with
 * a well-known set of exceptions worth listing by hand.
 */
const FEMALE_NAMES = new Set([
  'anna','anne','annika','bea','birgit','carmen','caro','carolin','caroline','christin',
  'christina','christine','claudia','dagmar','doris','edith','elena','elif','elisabeth',
  'ella','emilia','emily','emma','erika','esther','eva','franziska','gabi','gabriele',
  'hanna','hannah','heidi','heike','helen','helena','ines','ingrid','irene','iris',
  'isabel','isabelle','jana','janine','jasmin','jennifer','jenny','jessica','johanna',
  'judith','julia','juliane','karin','katharina','kathrin','katja','kerstin','klara',
  'lea','lena','leonie','lilli','lilly','linda','lisa','luisa','luise','magdalena',
  'maike','manuela','mara','maria','marie','marina','marion','marlene','marta','martha',
  'martina','melanie','mia','michaela','miriam','monika','nadine','nele','nicole','nina',
  'noemi','olivia','paula','pauline','petra','pia','ramona','rebecca','regina','renate',
  'ricarda','rita','romy','rosa','ruth','sabine','sandra','sara','sarah','silke','simone',
  'sonja','sophia','sophie','stefanie','stephanie','susanne','svenja','tanja','tina',
  'ulrike','ursula','vanessa','vera','verena','veronika','victoria','viktoria','wiebke',
  'yvonne','zoe',
])

/** Names that end in -a but are not female. */
const MALE_A_NAMES = new Set([
  'luca','luka','noah','elia','elias','joshua','attila','nikita','sascha','mischa',
  'jona','jonah','andrea','nicola','kuzma','ilja','ezra',
])

const FEMALE_ENDINGS = ['ine', 'ette', 'elle', 'ika', 'ina', 'issa', 'lyn', 'beth']

export function looksFemale(name: string): boolean {
  const token = normalise(firstToken(name))
  if (!token) return false
  if (FEMALE_NAMES.has(token)) return true
  if (MALE_A_NAMES.has(token)) return false
  if (token.endsWith('a')) return true
  return FEMALE_ENDINGS.some((ending) => token.endsWith(ending))
}

// ---------------------------------------------------------------- lookup

/** The picture for this player. Everyone gets one; nobody is left blank. */
export function portraitFor(name: string): string {
  const token = normalise(firstToken(name))
  const whole = normalise(name)
  const file = BY_ALIAS.get(token) ?? BY_ALIAS.get(whole)
  if (file) return `${PORTRAIT_DIR}/${file}.webp`
  return `${PORTRAIT_DIR}/${looksFemale(name) ? GUEST_FEMALE : GUEST_MALE}.webp`
}

/** True when the player has a face of their own rather than a guest one. */
export function hasOwnPortrait(name: string): boolean {
  const token = normalise(firstToken(name))
  return BY_ALIAS.has(token) || BY_ALIAS.has(normalise(name))
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
