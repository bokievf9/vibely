'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Spinner } from '@/components/ui/spinner'

export type StatusRow = { key: string; tone: 'error' | 'progress' | 'info'; text: string }

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// Status lines float above the composer instead of growing it, so the input and the message list
// never jump when "Sending photo…" or an error appears and goes.
export function ComposerStatus({ rows }: { rows: StatusRow[] }) {
  const reduce = useReducedMotion()
  const shift = (px: number) => `translateY(${reduce ? 0 : px}px)`
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-full mb-2 flex flex-col items-start gap-1.5 pr-14">
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <motion.p
            key={row.key}
            layout="position"
            role={row.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, transform: shift(6) }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: shift(4), transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={
              row.tone === 'error'
                ? // TODO(integration): text-danger once the shell tokens land.
                  'bg-surface/95 border-border max-w-full rounded-2xl border px-3 py-1.5 text-sm [overflow-wrap:anywhere] text-red-400 shadow-lg backdrop-blur'
                : row.tone === 'progress'
                  ? 'bg-surface/95 border-border text-muted flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-lg backdrop-blur'
                  : 'bg-surface/95 border-border text-muted max-w-full rounded-2xl border px-3 py-1.5 text-xs shadow-lg backdrop-blur'
            }
          >
            {row.tone === 'progress' && <Spinner className="size-4" />}
            {row.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}
