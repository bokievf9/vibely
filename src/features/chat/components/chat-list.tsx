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
          className="btn-accent mt-2 inline-flex h-[3.25rem] items-center justify-center rounded-2xl px-7 font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          {dict.chatui.goDiscover}
        </LocaleLink>
      </EmptyState>
    )
  }
  const fresh = chats.filter((c) => !c.lastMessage)
  const threads = chats.filter((c) => c.lastMessage)

  return (
    <div className="flex flex-col gap-3 pt-2 pb-4">
      {fresh.length > 0 && (
        <section aria-labelledby="new-matches" className="flex flex-col gap-3">
          <h2 id="new-matches" className="text-headline flex items-center gap-2 px-4">
            {dict.chatui.newMatches}
            <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
              {fresh.length}
            </span>
          </h2>
          <ul className="flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1 [&::-webkit-scrollbar]:hidden">
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
            <h2 id="messages" className="text-headline px-4 pt-3 pb-1">
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
        <p className="text-muted text-callout px-4 py-6 text-center">
          {dict.chatui.onlyNewMatches}
        </p>
      )}
    </div>
  )
}

function NewMatch({ chat: c }: { chat: ChatPreview }) {
  return (
    <LocaleLink
      href={`/chats/${c.matchId}`}
      className="flex w-[5.5rem] flex-col items-center gap-2 rounded-2xl px-1 py-1 transition-transform duration-150 ease-out active:scale-95"
    >
      {/* Gradient ring (new, not opened yet), with a gap in the background color. */}
      <span className="bg-accent-gradient relative flex rounded-full p-[2.5px] shadow-[0_8px_20px_-10px_rgb(255_77_125/0.7)]">
        <span className="bg-background flex rounded-full p-[2.5px]">
          <Avatar photo={c.partner.photo} alt={c.partner.name} size={70} />
        </span>
        {c.online && <OnlineDot className="right-1 bottom-1" />}
      </span>
      <span className="w-full truncate text-center text-[13px] font-semibold tracking-[-0.005em]">
        {c.partner.name}
      </span>
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
      case 'referral':
        return dict.matchmaker.preview
      default:
        return m.body ?? ''
    }
  })()
  const at = m?.at ?? c.createdAt
  return (
    <LocaleLink
      href={`/chats/${c.matchId}`}
      className="group active:bg-fill flex items-center gap-3.5 pl-4 transition-colors duration-150"
    >
      <span className="relative shrink-0 py-2.5">
        <Avatar photo={c.partner.photo} alt={c.partner.name} size={60} />
        {c.online && <OnlineDot className="right-0 bottom-2.5" />}
      </span>
      {/* Inset hairline between rows (starts after the avatar, like iOS lists). */}
      <div className="flex min-h-[5rem] min-w-0 flex-1 flex-col justify-center gap-1 pr-4 shadow-[inset_0_-1px_0_var(--border)] group-last:shadow-none">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('text-headline min-w-0 truncate', c.unread > 0 && 'font-bold')}>
            {c.partner.name}
          </span>
          <time
            className={cn(
              'text-footnote shrink-0 tabular-nums',
              c.unread ? 'text-accent font-semibold' : 'text-muted',
            )}
            dateTime={at}
          >
            {formatChatTime(at, locale)}
          </time>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-callout min-w-0 truncate',
              c.unread ? 'text-foreground font-medium' : 'text-muted',
            )}
          >
            {m?.mine && <span className="text-muted font-normal">{dict.chats.you}</span>}
            {preview}
          </span>
          {c.unread > 0 && (
            <span
              aria-label={fmt(dict.nav.unread, { count: c.unread })}
              className="bg-accent-gradient text-accent-foreground flex h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums shadow-[0_4px_10px_-4px_rgb(255_77_125/0.8)]"
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
      className={cn(
        'border-background bg-success absolute size-4 rounded-full border-[3px]',
        className,
      )}
    />
  )
}
