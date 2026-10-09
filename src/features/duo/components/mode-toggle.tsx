'use client'

import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

// Discover: Solo (one-to-one swipes) or Duo (two friends browse other duos). A segmented control
// made of links, so the mode lives in the URL (?mode=duo) and survives a reload or a push link.
export function DiscoverModeToggle({ mode }: { mode: 'solo' | 'duo' }) {
  const { dict } = useI18n()
  const t = dict.duo
  return (
    <nav
      aria-label={t.modeLabel}
      className="bg-surface-raised mx-auto flex w-full max-w-[16rem] shrink-0 rounded-full p-1 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {(['solo', 'duo'] as const).map((m) => (
        <LocaleLink
          key={m}
          href={m === 'duo' ? '/swipe?mode=duo' : '/swipe'}
          replace
          scroll={false}
          aria-current={m === mode ? 'page' : undefined}
          className={cn(
            'flex h-9 flex-1 items-center justify-center rounded-full text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
            m === mode ? 'bg-accent-gradient text-accent-foreground shadow-sm' : 'text-muted',
          )}
        >
          {m === 'duo' ? t.modeDuo : t.modeSolo}
        </LocaleLink>
      ))}
    </nav>
  )
}
