'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// One short message at a time above the tab bar ("Thanks, we will let you know"). A tiny module
// store instead of a library: call toast() from any client component, <Toaster /> renders it.
// Enter and exit are CSS transitions (interruptible); reduced motion keeps only the fade.

type Toast = { id: number; text: string; tone: 'success' | 'error'; visible: boolean }

const DURATION = 3200
const EXIT = 220

let current: Toast | null = null
let seq = 0
let timers: ReturnType<typeof setTimeout>[] = []
const listeners = new Set<() => void>()

const set = (next: Toast | null) => {
  current = next
  listeners.forEach((l) => l())
}

export function toast(text: string, tone: Toast['tone'] = 'success') {
  timers.forEach(clearTimeout)
  const id = ++seq
  set({ id, text, tone, visible: false })
  // Next frame, so the transition starts from the hidden state.
  requestAnimationFrame(() => {
    if (current?.id === id) set({ ...current, visible: true })
  })
  timers = [
    setTimeout(() => current?.id === id && set({ ...current, visible: false }), DURATION),
    setTimeout(() => current?.id === id && set(null), DURATION + EXIT),
  ]
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const noopSubscribe = () => () => {}

export function Toaster() {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const item = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
  if (!mounted) return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+0.75rem)] z-[60] flex justify-center px-4"
    >
      {item && (
        <div
          key={item.id}
          className={cn(
            'card-raised flex max-w-sm items-center gap-2.5 px-4 py-3 text-[15px] font-medium',
            'transition-[opacity,translate] duration-200 ease-out motion-reduce:translate-y-0',
            item.visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          {item.tone === 'success' ? (
            <CircleCheck className="text-success size-5 shrink-0" aria-hidden />
          ) : (
            <CircleAlert className="text-danger size-5 shrink-0" aria-hidden />
          )}
          <span className="text-pretty">{item.text}</span>
        </div>
      )}
    </div>,
    document.body,
  )
}
