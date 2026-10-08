'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useAutoGrow } from '@/features/feed/components/use-auto-grow'
import { RiskWarning } from '@/features/safety/components/risk-warning'
import { sendRandom } from '../actions'
import type { RandomMessage } from '../types'

const TYPING_THROTTLE_MS = 2_500
// Closer than this to the end counts as "reading the latest": new messages keep the view pinned.
const NEAR_BOTTOM_PX = 160

type Props = {
  sessionId: string
  messages: RandomMessage[]
  partnerTyping: boolean
  disabled: boolean
  // Replaces the composer in the same bottom slot (the "chat ended" card), so nothing above moves.
  footer?: ReactNode
  onSent: (m: RandomMessage) => void
  onTyping: () => void
}

const distanceFromBottom = () =>
  document.documentElement.scrollHeight - window.scrollY - window.innerHeight

export function AnonChat({
  sessionId,
  messages,
  partnerTyping,
  disabled,
  footer,
  onSent,
  onTyping,
}: Props) {
  const { dict, locale } = useI18n()
  const errorText = useErrorText()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const lastTyping = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nearBottom = useRef(true)
  useAutoGrow(inputRef, draft)

  // The page (window) scrolls. Track whether the reader is at the end, without layout reads on
  // every message.
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        nearBottom.current = distanceFromBottom() < NEAR_BOTTOM_PX
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Follow the conversation only when the reader is already at the end, or when it is my message.
  const last = messages.at(-1)
  const hasFooter = Boolean(footer)
  useLayoutEffect(() => {
    if (nearBottom.current || last?.mine) {
      window.scrollTo({ top: document.documentElement.scrollHeight })
    }
  }, [last?.id, last?.mine, partnerTyping, hasFooter])

  const type = (value: string) => {
    setDraft(value)
    const now = Date.now()
    if (value.trim() && now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now
      onTyping()
    }
  }

  const send = () => {
    const body = draft.trim()
    if (!body || pending || disabled) return
    startTransition(async () => {
      const result = await sendRandom(sessionId, body)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setDraft('')
      onSent(result.data)
    })
  }

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
                'rounded-2xl px-3.5 py-2 wrap-anywhere whitespace-pre-wrap',
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
            {!m.mine && <RiskWarning text={m.body} />}
          </li>
        ))}
        {partnerTyping && (
          <li className="text-muted text-sm italic">
            {dict.random.stranger} {dict.random.typing}
          </li>
        )}
      </ol>
      {footer ?? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          // Pinned to the bottom edge: the screen is immersive while chatting (no tab bar).
          className="bg-background/95 border-border sticky bottom-0 z-20 -mx-4 flex flex-col gap-1 border-t px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
        >
          {error && (
            <p role="alert" className="px-1 text-sm text-red-400">
              {errorText(error)}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              disabled={disabled}
              onChange={(e) => type(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              maxLength={1000}
              enterKeyHint="send"
              placeholder={dict.chats.placeholder}
              aria-label={dict.chats.placeholder}
              className="bg-surface border-border focus:border-accent max-h-32 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-2.5 text-base transition-colors outline-none disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 rounded-full"
              loading={pending}
              disabled={disabled || !draft.trim()}
              aria-label={dict.common.send}
              // Keep the keyboard up: the textarea must not lose focus to the button.
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.focus()}
            >
              <SendHorizontal className="size-5" />
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
