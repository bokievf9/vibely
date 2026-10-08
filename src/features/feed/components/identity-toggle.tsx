'use client'

import { UserRound, VenetianMask } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type Props = { asMe: boolean; onChange: (asMe: boolean) => void }

// "Anonymous / As me" switch for a post or comment. Anonymous is the default.
export function IdentityToggle({ asMe, onChange }: Props) {
  const { dict } = useI18n()
  const t = dict.feed.identity
  const option = (value: boolean, label: string, Icon: typeof UserRound) => (
    <button
      type="button"
      role="radio"
      aria-checked={asMe === value}
      onClick={() => onChange(value)}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition',
        asMe === value ? 'bg-accent text-accent-foreground' : 'text-muted',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label={t.label}
        className="bg-surface border-border inline-flex rounded-full border p-0.5"
      >
        {option(false, t.anonymous, VenetianMask)}
        {option(true, t.named, UserRound)}
      </div>
      <span className="text-muted text-xs">{asMe ? t.namedHint : t.anonymousHint}</span>
    </div>
  )
}
