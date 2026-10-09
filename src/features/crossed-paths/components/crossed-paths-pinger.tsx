'use client'

import { useEffect } from 'react'
import { crossedPathsEnabled, pingLocation } from '../actions'
import { pingDue } from '../format'

const LAST_ATTEMPT_KEY = 'vibely.crossedPaths.lastPing'

function readLast(): number | null {
  try {
    const v = localStorage.getItem(LAST_ATTEMPT_KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

function writeLast(at: number) {
  try {
    localStorage.setItem(LAST_ATTEMPT_KEY, String(at))
  } catch {
    // Private mode: the server still limits pings to one per ~10 minutes.
  }
}

// Let the next check run right away (after turning Crossed paths on).
export function resetCrossedPathsPing() {
  try {
    localStorage.removeItem(LAST_ATTEMPT_KEY)
  } catch {
    // Nothing to reset.
  }
}

async function permissionGranted() {
  if (!('geolocation' in navigator) || !navigator.permissions?.query) return false
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state === 'granted'
  } catch {
    return false
  }
}

// Crossed paths, foreground only: while the app is open and visible, at most every 10 minutes,
// and only when location permission was already granted (never prompts) and the setting is on.
// The setting is checked on the server before the location is even read.
export function CrossedPathsPinger() {
  useEffect(() => {
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return
      if (!pingDue(readLast(), Date.now())) return
      if (!(await permissionGranted())) return
      busy = true
      writeLast(Date.now())
      try {
        if (!(await crossedPathsEnabled())) return
        await new Promise<void>((resolve) =>
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
              void pingLocation(coords.latitude, coords.longitude).finally(resolve)
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
          ),
        )
      } catch {
        // Offline or a server hiccup: try again at the next interval.
      } finally {
        busy = false
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 60_000)
    const onVisible = () => void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
