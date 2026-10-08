'use client'

import { useEffect } from 'react'
import { touchPresence } from './actions'

const INTERVAL_MS = 60_000

let lastSent = 0

const beat = () => {
  if (document.visibilityState !== 'visible') return
  const now = Date.now()
  if (now - lastSent < INTERVAL_MS - 5_000) return
  lastSent = now
  void touchPresence()
}

// Keeps profiles.last_active_at fresh while the app is open and visible: once a minute and when
// the tab comes back to the foreground.
export function usePresenceHeartbeat() {
  useEffect(() => {
    beat()
    const timer = setInterval(beat, INTERVAL_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [])
}
