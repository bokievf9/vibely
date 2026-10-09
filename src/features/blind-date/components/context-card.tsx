'use client'

import { useState } from 'react'
import { Lightbulb, Newspaper } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { SessionContext } from '../types'

// Pinned at the top of a private reply / prompt conversation: the post being replied to, or the
// question of the day with both answers. Nothing here identifies anyone.
export function ContextCard({ context }: { context: SessionContext }) {
  const { dict, locale } = useI18n()
  const c = dict.conversations
  const [expanded, setExpanded] = useState(false)
  if (!context) return null

  if (context.kind === 'prompt') {
    const answer = (i: number | null) => (i === null ? null : (context.options[locale][i] ?? null))
    const mine = answer(context.myOption)
    const theirs = answer(context.partnerOption)
    return (
      <aside className="card mt-3 flex flex-col gap-2 px-4 py-3" aria-label={c.pinnedPrompt}>
        <Label icon={Lightbulb}>{c.pinnedPrompt}</Label>
        <p className="text-headline text-pretty">{context.question[locale]}</p>
        <p className="text-accent text-callout font-medium">
          {mine !== null && mine === theirs
            ? fmt(c.bothChose, { answer: mine })
            : [
                mine !== null && fmt(c.youChose, { answer: mine }),
                theirs !== null && fmt(c.theyChose, { answer: theirs }),
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
      </aside>
    )
  }

  const body = (
    <p
      className={cn('text-callout wrap-anywhere whitespace-pre-wrap', !expanded && 'line-clamp-4')}
    >
      {context.body}
    </p>
  )
  return (
    <aside className="card mt-3 flex flex-col gap-2 px-4 py-3" aria-label={c.pinnedPost}>
      <Label icon={Newspaper}>{c.pinnedPost}</Label>
      {context.body === null ? (
        <p className="text-muted text-callout">{c.postUnavailable}</p>
      ) : (
        <>
          <button
            type="button"
            className="text-left"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            {body}
          </button>
          {context.postId && (
            <LocaleLink
              href={`/feed/${context.postId}`}
              className="text-accent text-footnote self-start font-medium"
            >
              {dict.feed.post}
            </LocaleLink>
          )}
        </>
      )}
    </aside>
  )
}

function Label({ icon: Icon, children }: { icon: typeof Lightbulb; children: React.ReactNode }) {
  return (
    <span className="text-muted text-caption flex items-center gap-1.5 font-semibold tracking-wide uppercase">
      <Icon className="size-3.5" aria-hidden /> {children}
    </span>
  )
}
