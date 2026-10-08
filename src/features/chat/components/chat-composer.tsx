'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { Check, CircleUserRound, ImagePlus, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { sendMessage } from '../actions'
import { editMessage } from '../message-actions'
import type { RecordKind } from '../media'
import type { ChatMessage } from '../types'
import { ComposerBanner, type ComposerMode } from './composer-banner'
import { usePhotoSend } from './use-photo-send'
import type { Recording } from './use-recorder'
import { useRecordingSend } from './use-recording-send'
import { VideoRecorder } from './video-recorder'
import { VoiceRecorder } from './voice-recorder'

type Props = {
  matchId: string
  mode: ComposerMode | null
  quoteAuthor: string
  // Floating content above the composer (the "scroll down" button).
  aside?: ReactNode
  onCancelMode: () => void
  onSent: (m: ChatMessage) => void
  onEdited: (id: string, body: string, editedAt: string) => void
  onTyping: () => void
}

export function ChatComposer({ matchId, mode, quoteAuthor, aside, ...on }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [draft, setDraft] = useState('')
  // The edit text belongs to the message being edited; the normal draft is kept meanwhile.
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const photo = usePhotoSend(matchId, on.onSent)
  const recording = useRecordingSend(matchId, on.onSent)
  const [voiceActive, setVoiceActive] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const sending = photo.sending || recording.sending
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const editing = mode?.kind === 'edit' ? mode.message : null
  const text = editing ? (edit?.id === editing.id ? edit.text : (editing.body ?? '')) : draft
  const setText = (value: string) =>
    editing ? setEdit({ id: editing.id, text: value }) : setDraft(value)
  const replyTo = mode?.kind === 'reply' ? mode.message.id : null

  useEffect(() => {
    if (mode) inputRef.current?.focus()
  }, [mode])

  const submit = () =>
    startTransition(async () => {
      const body = text.trim()
      if (!body) return
      if (editing) {
        const result = await editMessage({ messageId: editing.id, body })
        if (!result.ok) return setError(result.error)
        on.onEdited(editing.id, body, result.data)
        setEdit(null)
      } else {
        const result = await sendMessage({ matchId, body, replyTo })
        if (!result.ok) return setError(result.error)
        setDraft('')
        on.onSent(result.data)
      }
      setError(undefined)
      on.onCancelMode()
    })

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    const failed = await photo.send(file, replyTo)
    setError(failed ?? undefined)
    if (!failed && replyTo) on.onCancelMode()
  }

  const sendRecording = async (kind: RecordKind, r: Recording | null) => {
    const failed = await recording.send(kind, r, replyTo)
    setError(failed ?? undefined)
    if (!failed && r && replyTo) on.onCancelMode()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="bg-background/95 border-border sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col gap-2 border-t px-3 py-2 backdrop-blur"
    >
      {aside && <div className="absolute right-3 bottom-full mb-3">{aside}</div>}
      {mode && <ComposerBanner mode={mode} author={quoteAuthor} onCancel={on.onCancelMode} />}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {errorText(error)}
        </p>
      )}
      {sending && (
        <p className="text-muted flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-4" />{' '}
          {photo.sending ? dict.chats.sendingPhoto : dict.media.sending}
        </p>
      )}
      {voiceActive && <p className="text-muted text-xs">{dict.media.safetyNote}</p>}
      <div className="flex items-end gap-1.5">
        {!editing && !voiceActive && (
          <>
            <IconButton
              label={dict.chats.sendPhoto}
              disabled={sending}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-6" />
            </IconButton>
            <IconButton
              label={dict.media.recordVideo}
              disabled={sending}
              onClick={() => setVideoOpen(true)}
            >
              <CircleUserRound className="size-6" />
            </IconButton>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void pickPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <textarea
          hidden={voiceActive}
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value.trim()) on.onTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape' && mode) on.onCancelMode()
          }}
          rows={1}
          maxLength={2000}
          placeholder={dict.chats.placeholder}
          aria-label={dict.chats.placeholder}
          className="bg-surface border-border focus:border-accent max-h-32 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-2.5 outline-none"
        />
        {!editing && !text.trim() ? (
          <VoiceRecorder
            disabled={sending}
            onActiveChange={setVoiceActive}
            onDone={(r) => void sendRecording('voice', r)}
            onError={setError}
          />
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            loading={pending}
            disabled={!text.trim()}
            aria-label={editing ? dict.common.save : dict.common.send}
          >
            {editing ? <Check className="size-5" /> : <SendHorizontal className="size-5" />}
          </Button>
        )}
      </div>
      {videoOpen && (
        <VideoRecorder
          onClose={() => setVideoOpen(false)}
          onDone={(r) => void sendRecording('video', r)}
          onError={setError}
        />
      )}
    </form>
  )
}

type IconButtonProps = {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function IconButton({ label, disabled, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="text-muted flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      {children}
    </button>
  )
}
