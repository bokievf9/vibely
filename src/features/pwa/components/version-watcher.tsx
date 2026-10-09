'use client'

import { useEffect } from 'react'
import { BUILD_ID, isOtherBuild } from '../skew'
import { hasPendingReload, isStaleClientError, reloadForNewVersion } from '../reload'

const CHECK_INTERVAL_MS = 10 * 60_000
// Focus and visibilitychange often fire together: one request is enough.
const MIN_GAP_MS = 5_000

// Keeps an open tab or installed PWA on the deployed build. After a deploy the old JavaScript
// calls Server Action ids the server no longer knows ("Failed to find Server Action"), so as soon
// as the server reports another build id, or an action/chunk fails that way, the page reloads.
export function VersionWatcher() {
  useEffect(() => {
    let lastCheck = 0
    let inFlight = false

    async function check() {
      const now = Date.now()
      if (inFlight || now - lastCheck < MIN_GAP_MS) return
      lastCheck = now
      inFlight = true
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { id } = (await res.json()) as { id?: unknown }
        if (isOtherBuild(id, BUILD_ID) || hasPendingReload()) reloadForNewVersion()
      } catch {
        // Offline or the server is restarting: the next check will tell.
      } finally {
        inFlight = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleClientError(event.reason) && reloadForNewVersion()) event.preventDefault()
    }
    const onError = (event: ErrorEvent) => {
      if (isStaleClientError(event.error ?? event.message)) reloadForNewVersion()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)
    const timer = window.setInterval(onVisible, CHECK_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
      window.clearInterval(timer)
    }
  }, [])
  return null
}
