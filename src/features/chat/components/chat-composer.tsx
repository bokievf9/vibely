'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Check, CircleUserRound, ImagePlus, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { editMessage } from '../message-actions'
import type { RecordKind } from '../media'
import type { ChatMessage } from '../types'
import { ComposerBanner, type ComposerMode } from './composer-banner'
import { CHAT_BAR_MATERIAL_CLASS } from './chat-layout'
import { ComposerStatus, type StatusRow } from './composer-status'
import { useFlash } from './use-flash'
import { usePhotoSend } from './use-photo-send'
import type { Recording } from './use-recorder'
import { useRecordingSend } from './use-recording-send'
import { VideoRecorder } from './video-recorder'
import { VoiceRecorder } from './voice-recorder'

// Text put into the composer from outside (an icebreaker); `at` makes repeated picks distinct.
export type ComposerPrefill = { text: string; at: number }

type Props = {
  matchId: string
  prefill?: ComposerPrefill | null
  mode: ComposerMode | null
  quoteAuthor: string
  // Floating content above the composer (the "scroll down" button).
  aside?: ReactNode
  // An error from the room (reactions, delete, history) shown in the same floating status.
  roomError?: string
  onCancelMode: () => void
  // Text: optimistic, the bubble is already on screen; resolves with the error, if any.
  onSend: (body: string, replyTo: string | null) => Promise<ErrorKey | null>
  // Photo, voice, video: added once stored.
  onSent: (m: ChatMessage) => void
  onEdited: (id: string, body: string, editedAt: string) => void
  onTyping: () => void
}

// 6 lines of 1.5rem plus the vertical padding and border: then the field scrolls.
const MAX_INPUT_PX = 6 * 24 + 20 + 2

export function ChatComposer({ matchId, mode, quoteAuthor, aside, prefill, ...on }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [draft, setDraft] = useState('')
  // The edit text belongs to the message being edited; the normal draft is kept meanwhile.
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null)
  const [error, flashError] = useFlash<ErrorKey>()
  const [saving, startTransition] = useTransition()
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

  // Adopt a new prefill during render (React's "adjust state on prop change" pattern), then focus.
  const [prefilled, setPrefilled] = useState(prefill)
  if (prefill !== prefilled) {
    setPrefilled(prefill)
    if (prefill) setDraft(prefill.text)
  }
  useEffect(() => {
    if (prefill) inputRef.current?.focus()
  }, [prefill])

  // Auto-grow: `field-sizing: content` where supported (CSS below), measured otherwise.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_INPUT_PX)}px`
  }, [text, voiceActive])

  const submit = () => {
    const body = text.trim()
    if (!body) return
    // Inside the tap/keypress: keeps the keyboard up on iOS.
    inputRef.current?.focus()
    if (editing) {
      startTransition(async () => {
        const result = await editMessage({ messageId: editing.id, body })
        if (!result.ok) return flashError(result.error)
        flashError(null)
        on.onEdited(editing.id, body, result.data)
        setEdit(null)
        on.onCancelMode()
      })
      return
    }
    // Optimistic: the bubble shows at once and the field is ready for the next message.
    setDraft('')
    if (replyTo) on.onCancelMode()
    void on.onSend(body, replyTo).then((failed) => failed && flashError(failed))
  }

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    const failed = await photo.send(file, replyTo)
    flashError(failed)
    if (!failed && replyTo) on.onCancelMode()
  }

  const sendRecording = async (kind: RecordKind, r: Recording | null) => {
    const failed = await recording.send(kind, r, replyTo)
    flashError(failed)
    if (!failed && r && replyTo) on.onCancelMode()
  }

  const status: StatusRow[] = []
  const shownError = errorText(error) ?? on.roomError
  if (shownError) status.push({ key: 'error', tone: 'error', text: shownError })
  if (sending) {
    status.push({
      key: 'sending',
      tone: 'progress',
      text: photo.sending ? dict.chats.sendingPhoto : dict.media.sending,
    })
  }
  if (voiceActive) status.push({ key: 'voice', tone: 'info', text: dict.media.safetyNote })

  const canSend = !!text.trim()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="relative shrink-0 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] group-data-[keyboard]/chat:pb-2"
    >
      {/* Material on its own layer (see CHAT_BAR_MATERIAL_CLASS): the video recorder below is a
          fixed overlay and must not be clipped to the composer. */}
      <div aria-hidden className={`${CHAT_BAR_MATERIAL_CLASS} border-t`} />
      {aside && <div className="absolute right-3 bottom-full mb-2">{aside}</div>}
      <ComposerStatus rows={status} />
      <ComposerBanner mode={mode} author={quoteAuthor} onCancel={on.onCancelMode} />
      <div className="relative flex items-end gap-1">
        {!editing && !voiceActive && (
          <>
            <IconButton
              label={dict.chats.sendPhoto}
              disabled={sending}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-[1.375rem]" />
            </IconButton>
            <IconButton
              label={dict.media.recordVideo}
              disabled={sending}
              onClick={() => setVideoOpen(true)}
            >
              <CircleUserRound className="size-[1.375rem]" />
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
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape' && mode) on.onCancelMode()
          }}
          rows={1}
          maxLength={2000}
          enterKeyHint="send"
          autoCapitalize="sentences"
          placeholder={dict.chats.placeholder}
          aria-label={dict.chats.placeholder}
          style={{ maxHeight: MAX_INPUT_PX }}
          className="bg-surface-raised border-border placeholder:text-muted focus:border-accent/50 [field-sizing:content] min-h-11 min-w-0 flex-1 resize-none overflow-y-auto overscroll-contain rounded-[1.375rem] border px-4 py-2.5 leading-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-[border-color] duration-150 outline-none"
        />
        {!editing && !canSend ? (
          <VoiceRecorder
            disabled={sending}
            onActiveChange={setVoiceActive}
            onDone={(r) => void sendRecording('voice', r)}
            onError={flashError}
          />
        ) : (
          <Button
            type="submit"
            size="icon"
            // Never take focus from the field: the keyboard stays up between messages.
            onPointerDown={(e) => e.preventDefault()}
            className="size-11 shrink-0 rounded-full transition-[transform,scale,opacity] starting:scale-75 starting:opacity-0"
            loading={saving}
            disabled={!canSend}
            aria-label={editing ? dict.common.save : dict.common.send}
          >
            {editing ? <Check className="size-5" /> : <SendHorizontal className="size-5" />}
          </Button>
        )}
      </div>
      <AnimatePresence>
        {videoOpen && (
          <VideoRecorder
            onClose={() => setVideoOpen(false)}
            onDone={(r) => void sendRecording('video', r)}
            onError={flashError}
          />
        )}
      </AnimatePresence>
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
      className="text-foreground/70 active:bg-fill flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform,scale] duration-150 ease-out active:scale-90 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
