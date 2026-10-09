'use client'

import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

// Discover: Solo (one-to-one swipes) or Duo (two friends browse other duos). A compact segmented
// control made of links in the header row (PageHeader `leading`, in place of the large title), so
// the deck keeps its room. The mode lives in the URL (?mode=duo) and survives a reload or a push.
export function DiscoverModeToggle({ mode }: { mode: 'solo' | 'duo' }) {
  const { dict } = useI18n()
  const t = dict.duo
  return (
    <nav
      aria-label={t.modeLabel}
      className="bg-surface-raised flex shrink-0 rounded-full p-0.5 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {(['solo', 'duo'] as const).map((m) => (
        <LocaleLink
          key={m}
          href={m === 'duo' ? '/swipe?mode=duo' : '/swipe'}
          replace
          scroll={false}
          aria-current={m === mode ? 'page' : undefined}
          className={cn(
            // 36px tall segments; the before: pseudo-element grows the tap target to 44px.
            'text-callout relative flex h-9 min-w-[3.75rem] items-center justify-center rounded-full px-3.5 font-semibold transition-[background-color,color,transform] duration-150 ease-out before:absolute before:inset-x-0 before:-inset-y-1 active:scale-[0.97]',
            m === mode ? 'bg-accent-gradient text-accent-foreground shadow-sm' : 'text-muted',
          )}
        >
          {m === 'duo' ? t.modeDuo : t.modeSolo}
        </LocaleLink>
      ))}
    </nav>
  )
}
