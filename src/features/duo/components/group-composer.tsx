'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ImagePlus, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { prepareImage } from '@/lib/image'
import { getBrowserClient } from '@/lib/supabase/client'
import { CHAT_BAR_MATERIAL_CLASS } from '@/features/chat/components/chat-layout'
import { ComposerStatus, type StatusRow } from '@/features/chat/components/composer-status'
import { CHAT_MEDIA_BUCKET } from '@/features/chat/types'
import { sendGroupMessage } from '../actions'
import type { GroupMessage } from '../types'

const MAX_INPUT_PX = 6 * 24 + 20 + 2
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

type Props = {
  groupId: string
  error?: string
  aside?: ReactNode
  onSent: (m: GroupMessage) => void
  onError: (e: ErrorKey | null) => void
  onTyping: () => void
}

// Text and photos only (no voice, video or calls in duo chats). Photos are compressed to WebP in
// the browser and uploaded to chat-media/<group id>/<uuid>.webp (storage RLS: current members).
export function GroupComposer({ groupId, error, aside, onSent, onError, onTyping }: Props) {
  const { dict } = useI18n()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState<'text' | 'photo' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending('text')
    const result = await sendGroupMessage({ groupId, body })
    setSending(null)
    if (!result.ok) return onError(result.error)
    onError(null)
    setDraft('')
    onSent(result.data)
  }

  const sendPhoto = async (source: File | undefined) => {
    if (!source) return
    if (!source.type.startsWith('image/') || source.size > MAX_SOURCE_BYTES) {
      return onError('invalidFile')
    }
    setSending('photo')
    try {
      const { file, width, height } = await prepareImage(source)
      const path = `${groupId}/${crypto.randomUUID()}.webp`
      const { error: upload } = await getBrowserClient()
        .storage.from(CHAT_MEDIA_BUCKET)
        .upload(path, file, { contentType: 'image/webp' })
      if (upload) return onError('photoSendFailed')
      const result = await sendGroupMessage({ groupId, image: { path, width, height } })
      if (!result.ok) return onError(result.error)
      onError(null)
      onSent(result.data)
    } catch {
      onError('photoSendFailed')
    } finally {
      setSending(null)
    }
  }

  const status: StatusRow[] = []
  if (error) status.push({ key: 'error', tone: 'error', text: error })
  if (sending === 'photo') {
    status.push({ key: 'sending', tone: 'progress', text: dict.chats.sendingPhoto })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="relative shrink-0 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] group-data-[keyboard]/chat:pb-2"
    >
      <div aria-hidden className={`${CHAT_BAR_MATERIAL_CLASS} border-t`} />
      {aside && <div className="absolute right-3 bottom-full mb-2">{aside}</div>}
      <ComposerStatus rows={status} />
      <div className="relative flex items-end gap-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!sending}
          aria-label={dict.chats.sendPhoto}
          className="text-foreground/70 active:bg-fill flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform,scale] duration-150 ease-out active:scale-90 disabled:opacity-50"
        >
          <ImagePlus className="size-[1.375rem]" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void sendPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (e.target.value.trim()) onTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={1}
          maxLength={2000}
          enterKeyHint="send"
          autoCapitalize="sentences"
          placeholder={dict.duo.groupPlaceholder}
          aria-label={dict.duo.groupPlaceholder}
          style={{ maxHeight: MAX_INPUT_PX }}
          className="bg-surface-raised border-border placeholder:text-muted focus:border-accent/50 [field-sizing:content] min-h-11 min-w-0 flex-1 resize-none overflow-y-auto overscroll-contain rounded-[1.375rem] border px-4 py-2.5 leading-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-[border-color] duration-150 outline-none"
        />
        <Button
          type="submit"
          size="icon"
          onPointerDown={(e) => e.preventDefault()}
          className="size-11 shrink-0 rounded-full"
          loading={sending === 'text'}
          disabled={!draft.trim() || !!sending}
          aria-label={dict.common.send}
        >
          <SendHorizontal className="size-5" />
        </Button>
      </div>
    </form>
  )
}
