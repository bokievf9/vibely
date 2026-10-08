'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n/client'

type Props = { visible: boolean; unseen: number; onClick: () => void }

// Floating "jump to latest" button with the count of messages that arrived while scrolled up.
export function ScrollDownButton({ visible, unseen, onClick }: Props) {
  const { dict } = useI18n()
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label={dict.chats.scrollDown}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="bg-surface border-border relative flex size-11 items-center justify-center rounded-full border shadow-lg"
        >
          <ChevronDown className="size-6" />
          {unseen > 0 && (
            <span className="bg-accent text-accent-foreground absolute -top-2 -right-1 min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-bold">
              {unseen}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
