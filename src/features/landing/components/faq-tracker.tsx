'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { track } from '@/lib/analytics'

// Native <details> stay server-rendered and work without JS; this only reports which question
// was opened (faq_open). `toggle` does not bubble, so it listens in the capture phase.
export function FaqTracker({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onToggle = (e: Event) => {
      const d = e.target
      if (d instanceof HTMLDetailsElement && d.open)
        track('faq_open', { index: Number(d.dataset.faq) })
    }
    el.addEventListener('toggle', onToggle, true)
    return () => el.removeEventListener('toggle', onToggle, true)
  }, [])
  return (
    <div ref={ref} className="flex flex-col gap-3">
      {children}
    </div>
  )
}
