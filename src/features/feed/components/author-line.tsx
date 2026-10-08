'use client'

import { useState, type ReactNode } from 'react'
import { BadgeCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { pseudonymColor, pseudonymEmoji, pseudonymName } from '../pseudonym'
import type { FeedIdentity } from '../types'
import { AuthorSheet } from './author-sheet'

type Props = {
  identity: FeedIdentity
  // Shown when an old anonymous row has no pseudonym.
  fallbackName: string
  size?: number
  nameClassName?: string
  children?: ReactNode
}

// Avatar + name of a post or comment author: the real profile ("As me", tap for a card)
// or the thread pseudonym with its colored icon.
export function AuthorLine({ identity, fallbackName, size = 32, nameClassName, children }: Props) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)

  if (identity.kind === 'anonymous') {
    const p = identity.pseudonym
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full',
            p ? pseudonymColor(p) : 'bg-surface',
          )}
          style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
          {p ? pseudonymEmoji(p) : '🙂'}
        </span>
        <span className={cn('truncate font-semibold', nameClassName)}>
          {p ? pseudonymName(dict.feed.pseudonym, p) : fallbackName}
        </span>
        {children}
      </span>
    )
  }

  const a = identity.author
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${dict.feed.profile}: ${a.name}`}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <Avatar
          photo={a.photoUrl ? { url: a.photoUrl, width: size, height: size } : null}
          alt=""
          size={size}
        />
        <span className={cn('truncate font-semibold', nameClassName)}>
          {a.name}
          {a.age !== null && `, ${fmt(dict.feed.ageYears, { age: a.age })}`}
        </span>
        {a.verified && (
          <BadgeCheck className="text-accent size-4 shrink-0" aria-label={dict.feed.verified} />
        )}
        {children}
      </button>
      <AuthorSheet userId={a.id} name={a.name} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
