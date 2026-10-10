// This device's copy of the tour state (localStorage 'vibely_tour'). It answers on its own while
// migration 20261010000200 is not applied, and keeps the tour from reopening when a server write
// failed. Browser only; every access is wrapped because storage can throw (private mode).
import { parseLocal, type LocalTourState } from './steps'

const KEY = 'vibely_tour'

export function readLocal(): LocalTourState {
  try {
    return parseLocal(window.localStorage.getItem(KEY))
  } catch {
    return { done: null, tips: [] }
  }
}

export function writeLocal(patch: Partial<LocalTourState>): void {
  try {
    const next = { ...readLocal(), ...patch }
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the server copy (when there is one) still counts.
  }
}

export function addLocalTip(key: string): void {
  const { tips } = readLocal()
  if (!tips.includes(key)) writeLocal({ tips: [...tips, key].slice(-32) })
}
