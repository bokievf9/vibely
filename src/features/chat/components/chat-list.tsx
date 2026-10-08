'use client'

import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { Avatar } from '@/components/ui/avatar'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import type { ChatPreview } from '../types'

const unreadLabel = (n: number) => (n > 99 ? '99+' : String(n))

// Matches without messages yet go to the "New matches" carousel; conversations below.
export function ChatList({ chats }: { chats: ChatPreview[] }) {
  const { dict } = useI18n()
  if (!chats.length) {
    return (
      <EmptyState icon={MessagesSquare} title={dict.chats.empty} text={dict.chats.emptyHint}>
        <LocaleLink
          href="/swipe"
          className="bg-accent text-accent-foreground mt-2 inline-flex h-12 items-center justify-center rounded-2xl px-6 font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          {dict.chatui.goDiscover}
        </LocaleLink>
      </EmptyState>
    )
  }
  const fresh = chats.filter((c) => !c.lastMessage)
  const threads = chats.filter((c) => c.lastMessage)

  return (
    <div className="flex flex-col gap-2 pb-4">
      {fresh.length > 0 && (
        <section aria-labelledby="new-matches" className="flex flex-col gap-2 pt-1">
          <h2 id="new-matches" className="text-muted px-4 text-sm font-semibold">
            {dict.chatui.newMatches}
          </h2>
          <ul className="flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-1 overflow-x-auto overscroll-x-contain px-3 pb-2 [&::-webkit-scrollbar]:hidden">
            {fresh.map((c) => (
              <li key={c.matchId} className="shrink-0 snap-start">
                <NewMatch chat={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {threads.length > 0 ? (
        <section aria-labelledby={fresh.length ? 'messages' : undefined}>
          {fresh.length > 0 && (
            <h2 id="messages" className="text-muted px-4 pb-1 text-sm font-semibold">
              {dict.chatui.messages}
            </h2>
          )}
          <ul className="flex flex-col">
            {threads.map((c) => (
              <li key={c.matchId}>
                <ChatRow chat={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-muted px-4 py-6 text-center text-sm">{dict.chatui.onlyNewMatches}</p>
      )}
    </div>
  )
}

function NewMatch({ chat: c }: { chat: ChatPreview }) {
  return (
    <LocaleLink
      href={`/chats/${c.matchId}`}
      className="flex w-20 flex-col items-center gap-1.5 rounded-2xl px-1 py-1 transition-transform duration-150 ease-out active:scale-95"
    >
      {/* Accent ring: new, not opened yet. */}
      <span className="ring-accent ring-offset-background relative block rounded-full ring-2 ring-offset-2">
        <Avatar photo={c.partner.photo} alt={c.partner.name} size={64} />
        {c.online && <OnlineDot className="right-0.5 bottom-0.5" />}
      </span>
      <span className="w-full truncate text-center text-xs font-medium">{c.partner.name}</span>
    </LocaleLink>
  )
}

function ChatRow({ chat: c }: { chat: ChatPreview }) {
  const { dict, locale } = useI18n()
  const m = c.lastMessage
  const preview = (() => {
    if (!m) return dict.chats.newMatch
    switch (m.kind) {
      case 'deleted':
        return dict.chats.deleted
      case 'photo':
        return fmt(dict.chatui.previewPhoto, { text: m.body ?? dict.chats.photo })
      case 'voice':
        return dict.media.previewVoice
      case 'video':
        return dict.media.previewVideo
      case 'expired':
        return m.body ?? dict.media.previewExpired
      default:
        return m.body ?? ''
    }
  })()
  const at = m?.at ?? c.createdAt
  return (
    <LocaleLink
      href={`/chats/${c.matchId}`}
      className="active:bg-surface flex items-center gap-3 px-4 py-3 transition-colors duration-150"
    >
      <span className="relative shrink-0">
        <Avatar photo={c.partner.photo} alt={c.partner.name} size={56} />
        {c.online && <OnlineDot className="right-0 bottom-0" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate font-semibold">{c.partner.name}</span>
          <time
            className={cn(
              'shrink-0 text-xs tabular-nums',
              c.unread ? 'text-accent font-medium' : 'text-muted',
            )}
            dateTime={at}
          >
            {formatChatTime(at, locale)}
          </time>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'min-w-0 truncate text-sm',
              c.unread ? 'text-foreground font-medium' : 'text-muted',
            )}
          >
            {m?.mine && <span className="text-muted font-normal">{dict.chats.you}</span>}
            {preview}
          </span>
          {c.unread > 0 && (
            <span
              aria-label={fmt(dict.nav.unread, { count: c.unread })}
              className="bg-accent text-accent-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums"
            >
              {unreadLabel(c.unread)}
            </span>
          )}
        </div>
      </div>
    </LocaleLink>
  )
}

function OnlineDot({ className }: { className?: string }) {
  const { dict } = useI18n()
  return (
    <span
      role="img"
      aria-label={dict.chats.online}
      // TODO(integration): bg-success once the shell tokens land.
      className={cn(
        'border-background absolute size-3.5 rounded-full border-2 bg-green-500',
        className,
      )}
    />
  )
}
