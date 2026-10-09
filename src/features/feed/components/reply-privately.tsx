'use client'

import { useState, useTransition } from 'react'
import { MessageSquareLock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { startPostConversation } from '@/features/blind-date/actions'

// "Reply privately" on someone else's post: a message only the author reads, in an anonymous
// conversation (the author keeps the post's name, the replier is "Partner #N"). Opens the
// conversation once sent; an ended conversation on the same post shows an error instead.
export function ReplyPrivately({ postId }: { postId: string }) {
  const { dict } = useI18n()
  const c = dict.conversations
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const send = () =>
    startTransition(async () => {
      const result = await startPostConversation(postId, body)
      if (!result.ok) return setError(result.error)
      if (result.data.state !== 'active') return setError('conversationUnavailable')
      setOpen(false)
      router.push(`/blind-date/${result.data.sessionId}`)
    })

  return (
    <>
      <button
        type="button"
        className="text-muted active:bg-fill ml-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors"
        onClick={() => setOpen(true)}
      >
        <MessageSquareLock className="size-[1.125rem] shrink-0" aria-hidden />
        {c.replyPrivately}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.replyTitle}>
        <div className="flex flex-col gap-4">
          <p className="text-muted text-sm">{c.replyHint}</p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder={c.replyPlaceholder}
            aria-label={c.replyPlaceholder}
            autoFocus
          />
          <FormError message={errorText(error)} />
          <Button fullWidth loading={pending} disabled={!body.trim()} onClick={send}>
            {dict.common.send}
          </Button>
        </div>
      </Modal>
    </>
  )
}
