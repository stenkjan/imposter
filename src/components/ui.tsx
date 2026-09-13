import { useState, type ReactNode } from 'react'
import { portraitFor } from '../game/portraits'
import { avatarColor, initials } from './Characters'

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
          ‹
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
 */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = {
    background: avatarColor(name),
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
  }

  if (failed) {
    return (
      <span className="avatar" style={style} aria-hidden="true">
        {initials(name)}
      </span>
    )
  }

  return (
    <img
      className="avatar"
      src={portraitFor(name)}
      style={style}
      onError={() => setFailed(true)}
      alt=""
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
