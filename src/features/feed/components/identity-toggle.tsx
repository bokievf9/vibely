'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import { UserRound, VenetianMask } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { PILL_SPRING } from './feed-tabs'

type Props = { asMe: boolean; onChange: (asMe: boolean) => void }

// "Anonymous / As me" switch for a post or comment. Anonymous is the default.
export function IdentityToggle({ asMe, onChange }: Props) {
  const { dict } = useI18n()
  const pillId = useId()
  const t = dict.feed.identity
  const option = (value: boolean, label: string, Icon: typeof UserRound) => {
    const selected = asMe === value
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onChange(value)}
        className={cn(
          'relative flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors',
          selected ? 'text-accent-foreground' : 'text-muted active:text-foreground',
        )}
      >
        {selected && (
          <motion.span
            layoutId={pillId}
            transition={PILL_SPRING}
            className="bg-accent absolute inset-0 rounded-full"
            aria-hidden
          />
        )}
        <Icon className="relative size-3.5" aria-hidden />
        <span className="relative">{label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        role="radiogroup"
        aria-label={t.label}
        className="bg-background border-border inline-flex rounded-full border p-0.5"
      >
        {option(false, t.anonymous, VenetianMask)}
        {option(true, t.named, UserRound)}
      </div>
      <span className="text-muted min-w-0 text-xs">{asMe ? t.namedHint : t.anonymousHint}</span>
    </div>
  )
}
