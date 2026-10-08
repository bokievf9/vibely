// Browser-only helpers (call from effects or event handlers, never during render).

export function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac with touch support.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone
  return window.matchMedia('(display-mode: standalone)').matches || legacy === true
}

// localStorage can throw (private mode, blocked storage): treat that as "not set".
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, String(Date.now()))
  } catch {}
}
