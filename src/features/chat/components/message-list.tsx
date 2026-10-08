'use client'

import { useMemo, type RefObject } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CallHistoryRow } from '@/features/calls/components/call-history'
import { withCalls } from '@/features/calls/timeline'
import type { CallEntry } from '@/features/calls/types'
import { useI18n } from '@/i18n/client'
import { dayKey, daysAgo, formatDay } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { groupMessages, type Outgoing } from '../chat-state'
import type { ChatMessage, Reaction, ReplyPreview } from '../types'
import { MessageBubble, type BubbleAction, type ListMessage } from './message-bubble'
import { TypingBubble } from './typing-bubble'

type Props = {
  messages: ChatMessage[]
  // Optimistic messages not replaced by a stored one yet (always the newest).
  outbox: Outgoing[]
  calls?: CallEntry[]
  reactions: Map<string, Reaction[]>
  viewerId: string
  partnerName: string
  partnerTyping: boolean
  hasMore: boolean
  loadingEarlier: boolean
  highlightId: string | null
  // The bubble whose long-press menu is open: shown lifted.
  liftedId: string | null
  // Ids that just arrived: those (and only those) rise in.
  fresh: RefObject<Set<string>>
  onLoadEarlier: () => void
  onAction: (message: ChatMessage, action: BubbleAction) => void
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
}

const NO_REACTIONS: Reaction[] = []
const NO_CALLS: CallEntry[] = []

const toPreview = (m: ChatMessage): ReplyPreview => ({
  id: m.id,
  senderId: m.senderId,
  body: m.body,
  mediaKind: m.media?.kind ?? m.expiredMedia,
  deleted: !!m.deletedAt,
})

const RISE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'

// New bubbles rise from the composer: 200ms ease-out, transform + opacity only, via WAAPI (no
// re-render, runs on the compositor). History, prepended pages and the stored copy of an
// optimistic message never animate.
function rise(el: HTMLElement, mine: boolean) {
  if (typeof el.animate !== 'function') return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.style.transformOrigin = mine ? 'bottom right' : 'bottom left'
  el.animate(
    reduce
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
    { duration: 200, easing: RISE_EASE },
  )
}

export function MessageList({
  messages,
  outbox,
  calls = NO_CALLS,
  reactions,
  viewerId,
  partnerName,
  partnerTyping,
  hasMore,
  loadingEarlier,
  highlightId,
  liftedId,
  fresh,
  onLoadEarlier,
  onAction,
  onRetry,
  onDiscard,
}: Props) {
  const { dict, locale } = useI18n()
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const all = useMemo<ListMessage[]>(
    () => [
      ...messages,
      ...outbox.map((o) => {
        const original = o.replyTo ? byId.get(o.replyTo) : undefined
        return {
          id: o.tempId,
          body: o.body,
          senderId: viewerId,
          createdAt: o.createdAt,
          readAt: null,
          editedAt: null,
          deletedAt: null,
          replyTo: o.replyTo,
          reply: original ? toPreview(original) : null,
          media: null,
          expiredMedia: null,
          local: o.status,
        }
      }),
    ],
    [messages, outbox, byId, viewerId],
  )
  const items = useMemo(() => withCalls(groupMessages(all, dayKey), calls), [all, calls])
  const lastOwn = messages.findLast((m) => m.senderId === viewerId)

  const dayLabel = (iso: string) => {
    const days = daysAgo(iso)
    return days === 0
      ? dict.chats.today
      : days === 1
        ? dict.chats.yesterday
        : formatDay(iso, locale)
  }

  return (
    <ol className="flex flex-col px-4 py-3" aria-live="polite">
      {hasMore && (
        <li className="flex justify-center pb-2">
          <Button variant="ghost" size="sm" loading={loadingEarlier} onClick={onLoadEarlier}>
            {dict.chats.loadEarlier}
          </Button>
        </li>
      )}
      {items.map((item) => {
        if (item.kind === 'call')
          return <CallHistoryRow key={`call-${item.call.id}`} call={item.call} />
        if (item.kind === 'day') {
          return (
            <li
              key={`day-${item.key}`}
              // Sticks right under the translucent header (its height includes the notch).
              className="pointer-events-none sticky top-[calc(var(--header-h)+0.5rem)] z-20 flex justify-center py-2"
            >
              <span className="bg-surface/85 text-muted rounded-full px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
                {dayLabel(item.at)}
              </span>
            </li>
          )
        }
        const m = item.message
        const mine = m.senderId === viewerId
        const original = m.replyTo ? byId.get(m.replyTo) : undefined
        const quote = original ? toPreview(original) : m.reply
        return (
          <li
            key={m.id}
            id={`msg-${m.id}`}
            ref={(el) => {
              if (el && fresh.current.delete(m.id)) rise(el, mine)
            }}
            className={cn(
              'flex max-w-[85%] min-w-0 scroll-mt-[calc(var(--header-h)+1rem)] flex-col',
              mine ? 'self-end' : 'self-start',
              item.groupStart ? 'mt-2' : 'mt-0.5',
            )}
          >
            <MessageBubble
              message={m}
              mine={mine}
              quote={quote}
              quoteAuthor={quote?.senderId === viewerId ? dict.chats.yourself : partnerName}
              tail={item.groupEnd}
              seen={m.id === lastOwn?.id && !!m.readAt}
              highlighted={highlightId === m.id}
              lifted={liftedId === m.id}
              reactions={reactions.get(m.id) ?? NO_REACTIONS}
              viewerId={viewerId}
              onAction={(action) => onAction(m, action)}
              onRetry={() => onRetry(m.id)}
              onDiscard={() => onDiscard(m.id)}
            />
          </li>
        )
      })}
      <AnimatePresence>
        {partnerTyping && <TypingBubble key="typing" name={partnerName} />}
      </AnimatePresence>
    </ol>
  )
}
