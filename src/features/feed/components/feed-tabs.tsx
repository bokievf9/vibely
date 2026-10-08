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
      className="grid grid-cols-3 gap-0.5 rounded-[0.875rem] bg-white/[0.07] p-[3px] shadow-[inset_0_1px_1px_rgb(0_0_0/0.25)]"
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
              'relative h-[2.375rem] min-w-0 rounded-[0.6875rem] px-2 text-[15px] font-semibold tracking-[-0.01em] transition-colors',
              "before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-['']",
              selected ? 'text-foreground' : 'text-muted active:text-foreground',
            )}
          >
            {selected && (
              <motion.span
                layoutId="feed-tab-pill"
                transition={PILL_SPRING}
                className="absolute inset-0 rounded-[0.6875rem] bg-[#3a3340] shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_2px_8px_rgb(0_0_0/0.35)]"
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
