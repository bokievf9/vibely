'use client'

import { ChevronRight, Eye } from 'lucide-react'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

// "Who viewed your profile" row (own profile page and Likes). Rendered only where
// my_profile_visitors exists (20261009000290).
export function VisitorsEntry({ count, className }: { count: number; className?: string }) {
  const { dict } = useI18n()
  const t = dict.vipPerks.visitors
  return (
    <LocaleLink
      href="/visitors"
      className={cn(
        'bg-surface-raised border-border active:bg-fill flex min-h-[3.75rem] items-center gap-3 rounded-[1.25rem] border px-4 py-3 transition-colors',
        className,
      )}
    >
      <span className="icon-tile">
        <Eye className="size-[1.125rem]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-medium tracking-[-0.01em]">{t.entry}</span>
        <span className="text-muted text-sm">{t.entryHint}</span>
      </span>
      {count > 0 && (
        <span className="bg-accent text-accent-foreground min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </LocaleLink>
  )
}
