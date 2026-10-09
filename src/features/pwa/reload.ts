import { unstable_isUnrecognizedActionError } from 'next/navigation'
import { canReloadAgain, isVersionSkewError, RELOAD_GUARD_KEY } from './skew'

// A screen that must not be torn down by an automatic reload (an ongoing call) carries this
// attribute; the reload then waits for the next version check.
export const NO_AUTO_RELOAD_ATTR = 'data-no-auto-reload'

let pending = false

// The error means this tab runs an older (or newer) build than the server.
export function isStaleClientError(error: unknown): boolean {
  return unstable_isUnrecognizedActionError(error) || isVersionSkewError(error)
}

// Full reload onto the deployed build, at most once per minute per tab. Returns true when a
// reload was started. Without sessionStorage there is no loop guard, so it never reloads then.
export function reloadForNewVersion(): boolean {
  if (typeof window === 'undefined') return false
  if (document.querySelector(`[${NO_AUTO_RELOAD_ATTR}]`)) {
    pending = true
    return false
  }
  try {
    const now = Date.now()
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY))
    if (!canReloadAgain(last || null, now)) return false
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
  } catch {
    return false
  }
  pending = false
  window.location.reload()
  return true
}

// A reload was postponed (a call was on screen): the next version check performs it.
export function hasPendingReload() {
  return pending
}
