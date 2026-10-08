'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'

const NEAR_BOTTOM_PX = 320

const distanceFromBottom = () =>
  document.documentElement.scrollHeight - window.scrollY - window.innerHeight

// The page (window) scrolls. New messages stick to the bottom unless the user is reading older
// history (then partner messages are counted for the "scroll down" button); a prepended page
// keeps the viewport anchored to the same message.
export function useStickToBottom(messages: ChatMessage[], viewerId: string, typing: boolean) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<number | null>(null)
  const mounted = useRef(false)
  const [away, setAway] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const firstId = messages[0]?.id
  const last = messages.at(-1)

  useLayoutEffect(() => {
    if (anchor.current === null) return
    window.scrollTo({ top: document.documentElement.scrollHeight - anchor.current })
    anchor.current = null
  }, [firstId])

  const prevLast = useRef(last?.id)
  useEffect(() => {
    const isNew = last?.id !== prevLast.current
    prevLast.current = last?.id
    const stick = !mounted.current || last?.senderId === viewerId
    mounted.current = true
    if (stick || distanceFromBottom() < NEAR_BOTTOM_PX) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    } else if (isNew && last) {
      setUnseen((n) => n + 1)
    }
    // Only a new last message (or the typing row) should move the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id, viewerId, typing])

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const isAway = distanceFromBottom() > NEAR_BOTTOM_PX
        setAway(isAway)
        if (!isAway) setUnseen(0)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return {
    bottomRef,
    away,
    unseen,
    toBottom: () => bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }),
    // Call right before older messages are prepended.
    keepAnchor: () => {
      anchor.current = document.documentElement.scrollHeight - window.scrollY
    },
  }
}
