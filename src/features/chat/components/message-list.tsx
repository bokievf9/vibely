'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { RiskWarning } from '@/features/safety/components/risk-warning'
import type { ChatMessage } from '../types'

type Props = {
  messages: ChatMessage[]
  viewerId: string
  partnerName: string
  partnerTyping: boolean
  hasMore: boolean
  loadingEarlier: boolean
  onLoadEarlier: () => void
}

const NEAR_BOTTOM_PX = 320

const distanceFromBottom = () =>
  document.documentElement.scrollHeight - window.scrollY - window.innerHeight

// The page (window) scrolls. New messages stick to the bottom unless the user is reading older
// history; a prepended page keeps the viewport anchored to the same message.
export function MessageList(props: Props) {
  const { messages, viewerId, partnerName, partnerTyping, hasMore, loadingEarlier } = props
  const { dict, locale } = useI18n()
  const bottomRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<number | null>(null)
  const firstId = messages[0]?.id
  const last = messages.at(-1)
  const lastOwn = messages.findLast((m) => m.senderId === viewerId)

  useLayoutEffect(() => {
    if (anchor.current === null) return
    window.scrollTo({ top: document.documentElement.scrollHeight - anchor.current })
    anchor.current = null
  }, [firstId])

  const mounted = useRef(false)
  useEffect(() => {
    const stick = !mounted.current || last?.senderId === viewerId
    mounted.current = true
    if (stick || distanceFromBottom() < NEAR_BOTTOM_PX) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [last?.id, last?.senderId, viewerId, partnerTyping])

  const loadEarlier = () => {
    anchor.current = document.documentElement.scrollHeight - window.scrollY
    props.onLoadEarlier()
  }

  return (
    <ol className="flex flex-1 flex-col gap-1.5 px-4 py-3" aria-live="polite">
      {hasMore && (
        <li className="flex justify-center pb-2">
          <Button variant="ghost" size="sm" loading={loadingEarlier} onClick={loadEarlier}>
            {dict.chats.loadEarlier}
          </Button>
        </li>
      )}
      {messages.map((m) => {
        const mine = m.senderId === viewerId
        return (
          <li
            key={m.id}
            className={cn(
              'flex max-w-[80%] flex-col',
              mine ? 'items-end self-end' : 'items-start self-start',
            )}
          >
            <p
              className={cn(
                'rounded-2xl px-3.5 py-2 break-words whitespace-pre-wrap',
                mine
                  ? 'bg-accent text-accent-foreground rounded-br-md'
                  : 'bg-surface rounded-bl-md',
              )}
            >
              {m.body}
            </p>
            <span className="text-muted px-1 text-[10px]">
              <time dateTime={m.createdAt}>{formatTime(m.createdAt, locale)}</time>
              {m.id === lastOwn?.id && m.readAt && <> · {dict.chats.seen}</>}
            </span>
            {!mine && <RiskWarning text={m.body} />}
          </li>
        )
      })}
      {partnerTyping && (
        <li className="text-muted self-start text-sm italic">
          {partnerName} {dict.chats.typing}
        </li>
      )}
      <div ref={bottomRef} />
    </ol>
  )
}
