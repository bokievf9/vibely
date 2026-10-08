'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { RiskWarning } from '@/features/safety/components/risk-warning'
import { sendMessage } from '../actions'
import type { ChatMessage } from '../types'
import { useChatMessages } from './use-chat-messages'

type Props = { matchId: string; viewerId: string; initialMessages: ChatMessage[] }

export function ChatRoom({ matchId, viewerId, initialMessages }: Props) {
  const { dict, locale } = useI18n()
  const errorText = useErrorText()
  const { messages, add } = useChatMessages(matchId, viewerId, initialMessages)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => bottomRef.current?.scrollIntoView({ block: 'end' }), [messages.length])

  const send = () =>
    startTransition(async () => {
      const body = draft.trim()
      if (!body) return
      const result = await sendMessage({ matchId, body })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setDraft('')
      add(result.data)
    })

  return (
    <div className="flex flex-1 flex-col">
      <ol className="flex flex-1 flex-col gap-1.5 px-4 py-3" aria-live="polite">
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
              <time className="text-muted px-1 text-[10px]" dateTime={m.createdAt}>
                {formatTime(m.createdAt, locale)}
              </time>
              {!mine && <RiskWarning text={m.body} />}
            </li>
          )
        })}
        <div ref={bottomRef} />
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="bg-background/95 border-border sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col gap-1 border-t px-3 py-2 backdrop-blur"
      >
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {errorText(error)}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={dict.chats.placeholder}
            aria-label={dict.chats.placeholder}
            className="bg-surface border-border focus:border-accent max-h-32 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-2.5 outline-none"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 rounded-full"
            loading={pending}
            disabled={!draft.trim()}
            aria-label={dict.common.send}
          >
            <SendHorizontal className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  )
}
