'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { sendRandom } from '../actions'
import type { RandomMessage } from '../types'

const TYPING_THROTTLE_MS = 2_500

type Props = {
  sessionId: string
  messages: RandomMessage[]
  partnerTyping: boolean
  disabled: boolean
  onSent: (m: RandomMessage) => void
  onTyping: () => void
}

export function AnonChat({
  sessionId,
  messages,
  partnerTyping,
  disabled,
  onSent,
  onTyping,
}: Props) {
  const { dict, locale } = useI18n()
  const errorText = useErrorText()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const lastTyping = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(
    () => bottomRef.current?.scrollIntoView({ block: 'end' }),
    [messages.length, partnerTyping],
  )

  const type = (value: string) => {
    setDraft(value)
    const now = Date.now()
    if (now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now
      onTyping()
    }
  }

  const send = () =>
    startTransition(async () => {
      const result = await sendRandom(sessionId, draft)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setDraft('')
      onSent(result.data)
    })

  return (
    <div className="flex flex-1 flex-col">
      <ol className="flex flex-1 flex-col gap-1.5 py-3" aria-live="polite">
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              'flex max-w-[80%] flex-col',
              m.mine ? 'items-end self-end' : 'items-start self-start',
            )}
          >
            <p
              className={cn(
                'rounded-2xl px-3.5 py-2 break-words whitespace-pre-wrap',
                m.mine
                  ? 'bg-accent text-accent-foreground rounded-br-md'
                  : 'bg-surface rounded-bl-md',
              )}
            >
              {m.body}
            </p>
            <time className="text-muted px-1 text-[10px]" dateTime={m.createdAt}>
              {formatTime(m.createdAt, locale)}
            </time>
          </li>
        ))}
        {partnerTyping && (
          <li className="text-muted text-sm italic">
            {dict.random.stranger} {dict.random.typing}
          </li>
        )}
        <div ref={bottomRef} />
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.trim()) send()
        }}
        className="bg-background/95 border-border sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 flex flex-col gap-1 border-t px-3 py-2 backdrop-blur"
      >
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {errorText(error)}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            disabled={disabled}
            onChange={(e) => type(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (draft.trim()) send()
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={dict.chats.placeholder}
            aria-label={dict.chats.placeholder}
            className="bg-surface border-border focus:border-accent max-h-32 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-2.5 outline-none disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 rounded-full"
            loading={pending}
            disabled={disabled || !draft.trim()}
            aria-label={dict.common.send}
          >
            <SendHorizontal className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  )
}
