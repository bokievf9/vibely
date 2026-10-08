'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const NEAR_BOTTOM_PX = 160

// The message scroller is `flex-direction: column-reverse` around one content box, so its scroll
// origin is the bottom: it opens at the latest message before any JS runs (no jump after
// hydration), and when the keyboard opens, the composer grows or older history is prepended,
// the distance from the bottom is what the browser keeps, so the view stays put by itself.
// scrollTop is 0 at the bottom and negative above it.
//
// What is left for JS: a new last message sticks to the bottom when the user is near it (or sent
// it); otherwise it is counted for the "scroll down" button and the view is held in place.
export function useStickToBottom(lastId: string | undefined, lastMine: boolean, typing: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const height = useRef(0)
  const [away, setAway] = useState(false)
  const [unseen, setUnseen] = useState(0)

  const distance = () => Math.abs(scrollRef.current?.scrollTop ?? 0)

  // Before paint on mount: start at the bottom even if the browser restored a scroll position.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
    height.current = el.scrollHeight
  }, [])

  const prevLast = useRef(lastId)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isNew = lastId !== prevLast.current
    prevLast.current = lastId
    const grown = el.scrollHeight - height.current
    height.current = el.scrollHeight
    if ((isNew && lastMine) || distance() < NEAR_BOTTOM_PX) {
      el.scrollTop = 0
      return
    }
    // Reading history: content added at the bottom would push the text being read upwards.
    if (grown > 0) el.scrollTop -= grown
    if (isNew && !lastMine) setUnseen((n) => n + 1)
  }, [lastId, lastMine, typing])

  // After every commit (a prepended page, an edit): the baseline for the next comparison.
  useLayoutEffect(() => {
    if (scrollRef.current) height.current = scrollRef.current.scrollHeight
  })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        height.current = el.scrollHeight
        const isAway = distance() > NEAR_BOTTOM_PX
        setAway(isAway)
        if (!isAway) setUnseen(0)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  return {
    scrollRef,
    away,
    unseen,
    toBottom: () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
  }
}
