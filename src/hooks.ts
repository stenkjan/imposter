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

/** Countdown in whole seconds that keeps time across a backgrounded tab. */
export function useCountdown(seconds: number, running: boolean, onDone?: () => void) {
  const [remaining, setRemaining] = useState(seconds)
  const deadline = useRef<number | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    setRemaining(seconds)
    deadline.current = null
  }, [seconds])

  useEffect(() => {
    if (!running || seconds <= 0) return
    deadline.current = Date.now() + remaining * 1000
    const tick = () => {
      const left = Math.max(0, Math.round(((deadline.current ?? 0) - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) done.current?.()
    }
    const id = window.setInterval(tick, 250)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // `remaining` is intentionally read once per start/pause, not per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, seconds])

  return { remaining, reset: () => setRemaining(seconds) }
}

/** Short haptic tap where the platform supports it (Android Chrome). */
export function buzz(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
