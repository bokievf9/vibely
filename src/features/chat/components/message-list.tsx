'use client'

import { useMemo, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { dayKey, daysAgo, formatDay } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { groupMessages } from '../chat-state'
import type { ChatMessage, Reaction, ReplyPreview } from '../types'
import { MessageBubble, type BubbleAction } from './message-bubble'

type Props = {
  messages: ChatMessage[]
  reactions: Map<string, Reaction[]>
  viewerId: string
  partnerName: string
  partnerTyping: boolean
  hasMore: boolean
  loadingEarlier: boolean
  highlightId: string | null
  bottomRef: RefObject<HTMLDivElement | null>
  onLoadEarlier: () => void
  onAction: (message: ChatMessage, action: BubbleAction) => void
}

const NO_REACTIONS: Reaction[] = []

const toPreview = (m: ChatMessage): ReplyPreview => ({
  id: m.id,
  senderId: m.senderId,
  body: m.body,
  hasImage: !!m.image,
  deleted: !!m.deletedAt,
})

export function MessageList({
  messages,
  reactions,
  viewerId,
  partnerName,
  partnerTyping,
  hasMore,
  loadingEarlier,
  highlightId,
  bottomRef,
  onLoadEarlier,
  onAction,
}: Props) {
  const { dict, locale } = useI18n()
  const items = useMemo(() => groupMessages(messages, dayKey), [messages])
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
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
    <ol className="flex flex-1 flex-col px-4 py-3" aria-live="polite">
      {hasMore && (
        <li className="flex justify-center pb-2">
          <Button variant="ghost" size="sm" loading={loadingEarlier} onClick={onLoadEarlier}>
            {dict.chats.loadEarlier}
          </Button>
        </li>
      )}
      {items.map((item) => {
        if (item.kind === 'day') {
          return (
            <li key={`day-${item.key}`} className="sticky top-16 z-20 flex justify-center py-2">
              <span className="bg-surface/90 text-muted rounded-full px-3 py-1 text-xs backdrop-blur">
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
            className={cn(
              'flex max-w-[85%] scroll-mt-24 flex-col',
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
              reactions={reactions.get(m.id) ?? NO_REACTIONS}
              viewerId={viewerId}
              onAction={(action) => onAction(m, action)}
            />
          </li>
        )
      })}
      {partnerTyping && (
        <li className="text-muted mt-2 self-start text-sm italic">
          {partnerName} {dict.chats.typing}
        </li>
      )}
      <div ref={bottomRef} />
    </ol>
  )
}
