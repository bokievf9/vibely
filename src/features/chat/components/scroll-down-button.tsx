'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n/client'

type Props = { visible: boolean; unseen: number; onClick: () => void }

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// Floating "jump to latest" button with the count of messages that arrived while scrolled up.
export function ScrollDownButton({ visible, unseen, onClick }: Props) {
  const { dict } = useI18n()
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onClick}
          // The input keeps focus (and the keyboard stays up) while jumping down.
          onPointerDown={(e) => e.preventDefault()}
          aria-label={dict.chats.scrollDown}
          initial={{ opacity: 0, transform: 'scale(0.9)' }}
          animate={{ opacity: 1, transform: 'scale(1)' }}
          exit={{ opacity: 0, transform: 'scale(0.9)', transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="bg-surface/95 border-border relative flex size-11 items-center justify-center rounded-full border shadow-lg backdrop-blur"
        >
          <ChevronDown className="size-6" />
          {unseen > 0 && (
            <span className="bg-accent text-accent-foreground absolute -top-2 -right-1 min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-bold tabular-nums">
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
