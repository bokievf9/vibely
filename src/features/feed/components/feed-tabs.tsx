'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { FEED_TABS, type FeedTab } from '../types'

// Interruptible: a second tap mid-slide retargets from where the pill is.
export const PILL_SPRING = { type: 'spring', duration: 0.35, bounce: 0.15 } as const

type Props = { tab: FeedTab; onChange: (tab: FeedTab) => void }

// New / Top / My city. The pill moves on tap; the list below shows a skeleton until it loads.
export function FeedTabs({ tab, onChange }: Props) {
  const { dict } = useI18n()
  return (
    <div
      role="tablist"
      aria-label={dict.feed.tabsLabel}
      className="bg-surface grid grid-cols-3 gap-1 rounded-full p-1"
    >
      {FEED_TABS.map((t) => {
        const selected = tab === t
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => !selected && onChange(t)}
            className={cn(
              'relative h-11 min-w-0 rounded-full px-2 text-sm font-medium transition-colors',
              selected ? 'text-accent-foreground' : 'text-muted active:text-foreground',
            )}
          >
            {selected && (
              <motion.span
                layoutId="feed-tab-pill"
                transition={PILL_SPRING}
                className="bg-accent absolute inset-0 rounded-full"
                aria-hidden
              />
            )}
            <span className="relative block truncate">{dict.feed.tabs[t]}</span>
          </button>
        )
      })}
    </div>
  )
}
