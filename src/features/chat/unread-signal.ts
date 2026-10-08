'use client'

// In-tab signal: something changed the unread total (e.g. markRead finished), re-fetch the badge.
const EVENT = 'vibely:unread-changed'

export function signalUnreadChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function onUnreadChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
