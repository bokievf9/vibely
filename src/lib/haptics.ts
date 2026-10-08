// Short vibration on meaningful moments only: swipe commit, match, like, reply threshold, voice lock.
// Android only; iOS Safari has no Vibration API, so this silently does nothing there.
const PATTERNS: Record<string, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 40, 18],
  warning: [24, 60, 24],
}

export type HapticKind = 'light' | 'medium' | 'success' | 'warning'

export function haptic(kind: HapticKind = 'light') {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // Never let feedback break the action that triggered it.
  }
}
