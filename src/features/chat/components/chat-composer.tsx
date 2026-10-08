'use client'

import { useState, useTransition } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { sendMessage } from '../actions'
import type { ChatMessage } from '../types'

type Props = { matchId: string; onSent: (m: ChatMessage) => void; onTyping: () => void }

export function ChatComposer({ matchId, onSent, onTyping }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const send = () =>
    startTransition(async () => {
      const body = draft.trim()
      if (!body) return
      const result = await sendMessage({ matchId, body })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setDraft('')
      onSent(result.data)
    })

  return (
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
          onChange={(e) => {
            setDraft(e.target.value)
            if (e.target.value.trim()) onTyping()
          }}
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
  )
}
