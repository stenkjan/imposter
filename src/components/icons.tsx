/**
 * Inline SVG instead of emoji for anything structural. Symbols like ⏻ are
 * missing from most phone fonts and render as a hollow box; a path always
 * draws. Everything inherits currentColor and the surrounding font size.
 */

type Props = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: 'false' as const,
})

export const IconBack = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M15 5 8 12l7 7" />
  </svg>
)

/** Leaving the room: a door with an arrow walking out of it. */
export const IconExit = ({ size = 19, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 8l-4 4 4 4" />
    <path d="M6 12h9" />
  </svg>
)

export const IconGear = ({ size = 19, className }: Props) => (
  // Eight thin spokes read as a sun at this size, so the gear is one filled
  // silhouette with a punched-out centre instead.
  <svg {...base(size)} className={className} stroke="none" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M19.1 12.9a7 7 0 0 0 0-1.9l2-1.5a.5.5 0 0 0 .1-.7l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.6-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5c-.6.2-1.1.6-1.6 1l-2.4-1a.5.5 0 0 0-.6.2L2.7 8.8a.5.5 0 0 0 .1.7l2 1.5a7 7 0 0 0 0 1.9l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1 .7 1.6 1l.4 2.5c0 .2.2.4.5.4h3.8c.3 0 .5-.2.5-.4l.4-2.5c.6-.3 1.1-.6 1.6-1l2.4 1c.2.1.5 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6l-2-1.6zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"
    />
  </svg>
)

export const IconShare = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
  </svg>
)

export const IconCheck = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
)

export const IconPlay = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" strokeLinejoin="round" />
  </svg>
)

export const IconCrown = ({ size = 14, className }: Props) => (
  <svg {...base(size)} className={className} strokeWidth={1.8}>
    <path d="M3 8l4 3.5L12 5l5 6.5L21 8l-1.6 10H4.6z" fill="currentColor" />
  </svg>
)

export const IconEye = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

/** Moving a player up or down the line-up in the lobby. */
export const IconUp = ({ size = 16, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M12 19V6" />
    <path d="M6 11l6-6 6 6" />
  </svg>
)

export const IconDown = ({ size = 16, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v13" />
    <path d="M6 13l6 6 6-6" />
  </svg>
)

/** Pulling the room in again by hand when the stream has gone quiet. */
export const IconRefresh = ({ size = 17, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </svg>
)

export const IconVote = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M4 13.5 9 18.5l11-11" />
    <path d="M4 20h16" />
  </svg>
)
