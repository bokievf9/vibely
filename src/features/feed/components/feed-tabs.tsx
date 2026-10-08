'use client'

import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { FEED_TABS, type FeedTab } from '../types'

type Props = { tab: FeedTab; onChange: (tab: FeedTab) => void; disabled?: boolean }

// New / Top / My city.
export function FeedTabs({ tab, onChange, disabled }: Props) {
  const { dict } = useI18n()
  return (
    <div
      role="tablist"
      aria-label={dict.feed.tabsLabel}
      className="bg-surface grid grid-cols-3 gap-1 rounded-full p-1"
    >
      {FEED_TABS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          disabled={disabled}
          onClick={() => tab !== t && onChange(t)}
          className={cn(
            'h-9 rounded-full text-sm font-medium transition',
            tab === t ? 'bg-accent text-accent-foreground' : 'text-muted',
          )}
        >
          {dict.feed.tabs[t]}
        </button>
      ))}
    </div>
  )
}
