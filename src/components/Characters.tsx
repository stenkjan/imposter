type Tone = 'civilian' | 'imposter' | 'neutral'

const FILL: Record<Tone, { body: string; shade: string }> = {
  civilian: { body: '#3ddc97', shade: '#22a874' },
  imposter: { body: '#f04f6a', shade: '#c23050' },
  neutral: { body: '#6f6f8a', shade: '#4b4b63' },
}

/**
 * Both roles share one silhouette on purpose — the only tells are colour
 * and the eyes, so a card never gives the game away by its shape.
 */
export function Crew({
  tone,
  size = 120,
  className,
}: {
  tone: Tone
  size?: number
  className?: string
}) {
  const c = FILL[tone]
  const sly = tone === 'imposter'
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      className={className}
      role="presentation"
      focusable="false"
    >
      {/* feet */}
      <rect x="34" y="126" width="20" height="16" rx="8" fill={c.shade} />
      <rect x="66" y="126" width="20" height="16" rx="8" fill={c.shade} />
      {/* backpack */}
      <rect x="8" y="72" width="20" height="44" rx="10" fill={c.shade} />
      {/* body */}
      <path
        d="M24 88a36 36 0 0 1 72 0v26a16 16 0 0 1-16 16H40a16 16 0 0 1-16-16z"
        fill={c.body}
      />
      {/* head */}
      <circle cx="60" cy="58" r="38" fill={c.body} />
      {/* visor */}
      <rect x="26" y="42" width="68" height="32" rx="16" fill="#12121a" />
      <rect x="32" y="47" width="22" height="10" rx="5" fill="#ffffff" opacity=".12" />
      {sly ? (
        <>
          <rect x="41" y="55" width="15" height="5" rx="2.5" fill="#f2f2f7" />
          <rect x="64" y="55" width="15" height="5" rx="2.5" fill="#f2f2f7" />
        </>
      ) : (
        <>
          <circle cx="48" cy="58" r="6.5" fill="#f2f2f7" />
          <circle cx="72" cy="58" r="6.5" fill="#f2f2f7" />
        </>
      )}
    </svg>
  )
}

/** Home-screen mark: the whole premise in one picture. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="presentation" focusable="false">
      <ellipse cx="100" cy="140" rx="78" ry="8" fill="#000" opacity=".28" />
      <g transform="translate(6 24) scale(0.72)">
        <Crew tone="civilian" />
      </g>
      <g transform="translate(112 24) scale(0.72)">
        <Crew tone="imposter" />
      </g>
      <g transform="translate(100 26)">
        <circle r="21" fill="#12121a" stroke="#3a3a50" strokeWidth="2" />
        <text
          textAnchor="middle"
          y="8"
          fontSize="24"
          fontWeight="800"
          fill="#f2f2f7"
          fontFamily="system-ui, sans-serif"
        >
          ?
        </text>
      </g>
    </svg>
  )
}

const AVATAR_HUES = [348, 12, 32, 48, 96, 150, 172, 196, 216, 262, 290, 320]

/** Stable colour per name so the same player keeps the same dot all game. */
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return `hsl(${AVATAR_HUES[h % AVATAR_HUES.length]} 72% 66%)`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? '?'
  const second = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + second).toUpperCase()
}
