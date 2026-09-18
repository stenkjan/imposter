import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { portraitFor } from '../game/portraits'
import { IconBack } from './icons'
import { avatarColor, initials } from './Characters'
import { usePortraitCard } from './PortraitCard'

export function TopBar({
  title,
  step,
  onBack,
  right,
}: {
  title: string
  step?: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
      )}
      <h1>{title}</h1>
      {step && <span className="step">{step}</span>}
      {right}
    </div>
  )
}

/**
 * Everyone has a face: a drawn portrait where one exists, a guest portrait
 * otherwise. The coloured initials stay as the fallback for the moment before
 * the picture loads and for the rare case where it never does.
 *
 * Tapping one opens it as a full card, unless `plain` says not to — inside a
 * button, such as a vote row, the tap belongs to the button.
 */
export function Avatar({
  name,
  size = 32,
  points,
  plain,
}: {
  name: string
  size?: number
  points?: number | null
  plain?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const openCard = usePortraitCard()
  const style = {
    background: avatarColor(name),
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
  }

  const show = openCard && !plain ? () => openCard({ name, points }) : null
  const tap = show
    ? {
        className: 'avatar tappable',
        role: 'button',
        tabIndex: 0,
        onClick: (event: { stopPropagation: () => void }) => {
          event.stopPropagation()
          show()
        },
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          show()
        },
      }
    : { className: 'avatar', 'aria-hidden': true as const }

  if (failed) {
    return (
      <span {...tap} style={style} aria-label={show ? name : undefined}>
        {initials(name)}
      </span>
    )
  }

  return (
    <img
      {...tap}
      src={portraitFor(name)}
      style={style}
      onError={() => setFailed(true)}
      alt={show ? name : ''}
      draggable={false}
    />
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  accent,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  accent?: boolean
  label: string
}) {
  return (
    <div className={accent ? 'segmented accent' : 'segmented'} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A small −/+ pair for a point rule; 0 reads as "off" rather than as a zero. */
export function Stepper({
  value,
  onChange,
  title,
  description,
  offLabel,
  min = 0,
  max = 9,
}: {
  value: number
  onChange: (next: number) => void
  title: string
  description: string
  offLabel: string
  min?: number
  max?: number
}) {
  const step = (by: number) => onChange(Math.min(Math.max(value + by, min), max))
  return (
    <div className="setting stepper-row">
      <div className="setting-label">
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <div className="stepper" role="group" aria-label={title}>
        <button onClick={() => step(-1)} disabled={value <= min} aria-label={`${title} −`}>
          −
        </button>
        <span className={value ? 'value' : 'value off'}>{value || offLabel}</span>
        <button onClick={() => step(1)} disabled={value >= max} aria-label={`${title} +`}>
          +
        </button>
      </div>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  title: string
  description: string
}) {
  return (
    <button className="toggle" aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span className="copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  )
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <h2>{title}</h2>
        {children}
      </div>
    </>
  )
}
