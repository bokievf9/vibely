'use client'

import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { VerifiedBadge } from '@/components/ui/verified-badge'
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
  /** Second line under the name (time, "you"). */
  meta?: ReactNode
  children?: ReactNode
}

// Avatar + name of a post or comment author: the real profile ("As me", tap for a card)
// or the thread pseudonym with its colored icon.
export function AuthorLine({
  identity,
  fallbackName,
  size = 32,
  nameClassName,
  meta,
  children,
}: Props) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)

  if (identity.kind === 'anonymous') {
    const p = identity.pseudonym
    return (
      <span className={cn('flex min-w-0 items-center', meta ? 'gap-3' : 'gap-2')}>
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_1px_rgb(255_255_255/0.06)]',
            p ? pseudonymColor(p) : 'bg-surface-raised',
          )}
          style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
          {p ? pseudonymEmoji(p) : '🙂'}
        </span>
        <Lines meta={meta}>
          <span className={cn('truncate font-semibold', nameClassName)}>
            {p ? pseudonymName(dict.feed.pseudonym, p) : fallbackName}
          </span>
          {children}
        </Lines>
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
        className={cn(
          'flex min-w-0 items-center rounded-full text-left transition-opacity active:opacity-70',
          meta ? 'gap-3' : 'gap-2',
        )}
      >
        <Avatar
          photo={a.photoUrl ? { url: a.photoUrl, width: size, height: size } : null}
          alt=""
          size={size}
        />
        <Lines meta={meta}>
          <span className={cn('truncate font-semibold', nameClassName)}>
            {a.name}
            {a.age !== null && `, ${fmt(dict.feed.ageYears, { age: a.age })}`}
          </span>
          {a.verified && <VerifiedBadge size={16} />}
          {/* The handle gives way first: a long name and a long handle must not both end in "…". */}
          {a.username && (
            <span className="text-muted max-w-[45%] min-w-0 shrink-[3] truncate text-xs">
              @{a.username}
            </span>
          )}
          {children}
        </Lines>
      </button>
      <AuthorSheet userId={a.id} name={a.name} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// Name row, plus an optional second line under it.
function Lines({ meta, children }: { meta?: ReactNode; children: ReactNode }) {
  if (!meta) return <>{children}</>
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1.5">{children}</span>
      <span className="text-muted text-footnote truncate">{meta}</span>
    </span>
  )
}
