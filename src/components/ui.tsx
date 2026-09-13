import type { ReactNode } from 'react'
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

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{
        background: avatarColor(name),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
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
