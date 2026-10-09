'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import styles from './typing-bubble.module.css'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// The partner's typing indicator as an incoming bubble with three animated dots.
export function TypingBubble({ name }: { name: string }) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  const offset = reduce ? 'translateY(0px)' : 'translateY(8px)'
  return (
    <motion.li
      className="mt-2 self-start"
      style={{ transformOrigin: 'bottom left' }}
      initial={{ opacity: 0, transform: offset }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <span
        role="status"
        aria-label={fmt(dict.chatui.typing, { name })}
        className="bg-surface-raised flex h-9 items-center gap-1 rounded-[1.25rem] rounded-bl-[0.375rem] px-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_var(--border)]"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden className={`${styles.dot} bg-muted size-1.5 rounded-full`} />
        ))}
      </span>
    </motion.li>
  )
}
