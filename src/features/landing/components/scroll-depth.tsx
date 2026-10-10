'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'

const MARKS = [25, 50, 75, 100] as const

// scroll_depth 25/50/75/100: four invisible markers at those heights of the page content,
// watched with IntersectionObserver (no scroll listener). Each fires once per page view.
// Render inside a `relative` wrapper around the content.
export function ScrollDepth() {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        track('scroll_depth', { percent: Number((entry.target as HTMLElement).dataset.mark) })
        io.unobserve(entry.target)
      }
    })
    for (const el of refs.current) if (el) io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <>
      {MARKS.map((mark, i) => (
        <span
          key={mark}
          ref={(el) => {
            refs.current[i] = el
          }}
          data-mark={mark}
          aria-hidden
          className="pointer-events-none absolute left-0 h-px w-px"
          style={{ top: `calc(${mark}% - 1px)` }}
        />
      ))}
    </>
  )
}
