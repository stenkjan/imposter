import { useEffect, useRef, useState } from 'react'

/** State mirrored into localStorage, so a reload does not lose the lineup. */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* private mode, quota, whatever — the game still works without it */
    }
  }, [key, value])

  return [value, setValue] as const
}

/**
 * Seconds left on a deadline that lives in the game state rather than in this
 * component. Every phone counts down to the same moment, a reload picks the
 * clock up where it was, and a second word round keeps eating into the same
 * minutes instead of starting over.
 *
 * `onExpired` fires once per deadline, on whichever device is watching.
 */
export function useDeadline(
  deadlineAt: number | null,
  pausedAt: number | null,
  onExpired?: () => void,
): number | null {
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef(false)
  const done = useRef(onExpired)
  done.current = onExpired

  useEffect(() => {
    fired.current = false
  }, [deadlineAt])

  useEffect(() => {
    if (deadlineAt === null || pausedAt !== null) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 250)
    // A backgrounded tab is throttled, so catch up the moment it comes back.
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deadlineAt, pausedAt])

  useEffect(() => {
    if (deadlineAt === null || pausedAt !== null || fired.current) return
    if (now < deadlineAt) return
    fired.current = true
    done.current?.()
  }, [now, deadlineAt, pausedAt])

  if (deadlineAt === null) return null
  return Math.max(0, Math.round((deadlineAt - (pausedAt ?? now)) / 1000))
}

/** Short haptic tap where the platform supports it (Android Chrome). */
export function buzz(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
