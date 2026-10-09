'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { Reaction, ReactionEmoji } from '../types'

type Props = {
  reactions: Reaction[]
  viewerId: string
  onToggle: (emoji: ReactionEmoji) => void
}

// Reaction chips under a bubble. Tapping one sets (or removes) the same emoji as your own.
// The pill is compact, the button around it is 32px tall. Chips that appear after the bubble
// pop in with a little spring; the ones already there on load do not animate.
export function MessageReactions({ reactions, viewerId, onToggle }: Props) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  const counts = new Map<ReactionEmoji, { count: number; mine: boolean }>()
  for (const r of reactions) {
    const c = counts.get(r.emoji) ?? { count: 0, mine: false }
    counts.set(r.emoji, { count: c.count + 1, mine: c.mine || r.userId === viewerId })
  }
  return (
    <ul
      className={cn('-mt-2 flex flex-wrap px-0.5', !counts.size && 'hidden')}
      aria-label={dict.chats.reactions}
    >
      <AnimatePresence initial={false}>
        {[...counts].map(([emoji, { count, mine }]) => (
          <motion.li
            key={emoji}
            initial={{ opacity: 0, transform: reduce ? 'scale(1)' : 'scale(0.6)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transform: reduce ? 'scale(1)' : 'scale(0.8)' }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.35 }}
          >
            <button
              type="button"
              onClick={() => onToggle(emoji)}
              aria-pressed={mine}
              aria-label={`${emoji} ${count}`}
              className="group/chip flex h-8 items-center px-0.5"
            >
              <span
                className={cn(
                  'border-background flex h-7 items-center gap-0.5 rounded-full border-2 px-1.5 text-sm leading-none transition-transform duration-150 ease-out group-active/chip:scale-90',
                  mine ? 'bg-accent/30' : 'bg-surface-raised',
                )}
              >
                <span aria-hidden>{emoji}</span>
                {count > 1 && <span className="text-xs tabular-nums">{count}</span>}
              </span>
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
