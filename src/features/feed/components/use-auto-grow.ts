'use client'

import { useLayoutEffect, type RefObject } from 'react'

// Grows a textarea with its content up to its CSS max-height (field-sizing: content is not in
// every Safari yet). Shared by the feed composers and the random-chat composer.
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }, [ref, value])
}
