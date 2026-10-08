'use client'

import { useEffect } from 'react'

// Full-screen screens (chat room, thread, blind date, match, like sheet) hide the tab bar and
// the install banner while they are on screen. This lives in an effect, not in a CSS :has()
// on the DOM: with cacheComponents, Next keeps the previous route mounted inside a hidden
// <Activity>, so its markup stays in the document after you navigate away. Effects are cleaned
// up when a route is hidden, so the flag goes away exactly when the screen does.
export function Immersive({ active = true }: { active?: boolean }) {
  useEffect(() => {
    if (!active) return
    const body = document.body
    body.dataset.immersive = String(Number(body.dataset.immersive ?? 0) + 1)
    return () => {
      const left = Number(body.dataset.immersive ?? 1) - 1
      if (left > 0) body.dataset.immersive = String(left)
      else delete body.dataset.immersive
    }
  }, [active])
  return null
}
