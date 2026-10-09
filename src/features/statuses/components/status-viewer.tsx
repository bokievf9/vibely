'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { Clock, Flag, Send, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { fmt } from '@/i18n/config'
import { LocaleLink, useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { startStatusConversation } from '@/features/blind-date/actions'
import { ReportDialog } from '@/features/safety/components/report-dialog'
import { timeLeft } from '../schemas'
import type { LiveStatus, OwnStatus, Photo } from '../types'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
// Drag thresholds: distance or a flick.
const CLOSE_Y = 120
const SWIPE_X = 70
const FLICK = 500

const noopSubscribe = () => () => {}

type OwnProps = {
  mode: 'own'
  own: OwnStatus
  me: { name: string; photo: Photo | null }
  onChange: () => void
  onClear: () => void
}

type PeopleProps = {
  mode: 'people'
  items: LiveStatus[]
  start: number
  onSeen: (id: string) => void
}

type Props = (OwnProps | PeopleProps) & { onClose: () => void }

// Full screen, like stories: the person's photo, their emoji and text, and Reply / Report.
// Swipe (or tap the sides) to move between statuses, drag down or press Escape to close.
export function StatusViewer(props: Props) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  if (!mounted) return null
  return createPortal(<Viewer {...props} />, document.body)
}

function Viewer(props: Props) {
  const { dict } = useI18n()
  const t = dict.statuses
  const reduce = useReducedMotion()
  const count = props.mode === 'people' ? props.items.length : 1
  const [index, setIndex] = useState(props.mode === 'people' ? props.start : 0)
  const [reporting, setReporting] = useState(false)
  const [typing, setTyping] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const { onClose } = props
  const onSeen = props.mode === 'people' ? props.onSeen : undefined
  const current = props.mode === 'people' ? props.items[index] : undefined

  const go = (delta: number) => {
    const next = index + delta
    if (next < 0) return
    if (next >= count) return onClose()
    setIndex(next)
  }

  useEffect(() => {
    if (current) onSeen?.(current.id)
  }, [current, onSeen])

  // Scroll lock and initial focus while open.
  useEffect(() => {
    const body = document.body
    const saved = body.style.overflow
    body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      body.style.overflow = saved
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reporting || typing) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y > CLOSE_Y || velocity.y > FLICK) onClose()
      return
    }
    if (offset.x < -SWIPE_X || velocity.x < -FLICK) go(1)
    else if (offset.x > SWIPE_X || velocity.x > FLICK) go(-1)
  }

  const person =
    props.mode === 'people' && current
      ? { name: current.name, age: current.age as number | null, photo: current.photo }
      : props.mode === 'own'
        ? { name: props.me.name, age: null, photo: props.me.photo }
        : null
  const status = props.mode === 'people' ? current : props.own
  if (!person || !status) return null
  const left = timeLeft(status.expiresAt)
  const leftText = left
    ? left.hours > 0
      ? fmt(t.timeLeft, { h: left.hours, m: left.minutes })
      : fmt(t.minutesLeft, { m: left.minutes })
    : ''
  const title = props.mode === 'own' ? t.textLabel : fmt(t.viewer, { name: person.name })

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[45] bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
    >
      <motion.div
        key={status.id}
        className="relative flex h-full flex-col overflow-hidden"
        drag={typing || reporting ? false : true}
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.7, left: 0.35, right: 0.35 }}
        onDragEnd={onDragEnd}
        initial={reduce ? false : { opacity: 0.6, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
      >
        {person.photo ? (
          <Image
            src={person.photo.url}
            alt=""
            fill
            sizes="100vw"
            draggable={false}
            className="pointer-events-none object-cover opacity-55 blur-[2px] select-none"
          />
        ) : (
          <div aria-hidden className="bg-accent-gradient absolute inset-0 opacity-40" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/85"
        />

        {/* Tap zones: left third back, right third forward (under the controls). */}
        {props.mode === 'people' && (
          <>
            <button
              type="button"
              aria-label={t.previous}
              onClick={() => go(-1)}
              className="absolute inset-y-24 left-0 w-1/3"
            />
            <button
              type="button"
              aria-label={t.next}
              onClick={() => go(1)}
              className="absolute inset-y-24 right-0 w-1/3"
            />
          </>
        )}

        <header className="relative z-10 flex flex-col gap-3 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          {count > 1 && (
            <ol aria-hidden className="flex gap-1">
              {Array.from({ length: count }, (_, i) => (
                <li
                  key={i}
                  className={cn('h-0.5 flex-1 rounded-full', i <= index ? 'bg-white' : 'bg-white/30')}
                />
              ))}
            </ol>
          )}
          <div className="flex items-center gap-2.5">
            <Avatar photo={person.photo} alt="" size={36} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {person.age !== null ? `${person.name}, ${person.age}` : t.you}
              </span>
              {leftText && (
                <span className="text-caption flex items-center gap-1 text-white/70">
                  <Clock className="size-3" aria-hidden /> {leftText}
                </span>
              )}
            </div>
            {props.mode === 'people' && (
              <button
                type="button"
                aria-label={t.report}
                onClick={() => setReporting(true)}
                className="flex size-11 items-center justify-center rounded-full active:bg-white/15"
              >
                <Flag className="size-5" />
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              aria-label={dict.common.close}
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full active:bg-white/15"
            >
              <X className="size-6" />
            </button>
          </div>
        </header>

        <div className="pointer-events-none relative z-0 flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span aria-hidden className="text-7xl drop-shadow-lg">
            {status.emoji}
          </span>
          <p className="text-2xl leading-snug font-semibold text-balance wrap-anywhere drop-shadow-md">
            {status.text}
          </p>
          {props.mode === 'own' && props.own.held && (
            <div className="flex max-w-xs flex-col items-center gap-1 rounded-2xl bg-amber-500/20 px-4 py-2 text-amber-200">
              <span className="text-sm font-semibold">{t.underReview}</span>
              <span className="text-footnote text-pretty">{t.underReviewHint}</span>
            </div>
          )}
        </div>

        <footer className="relative z-10 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {props.mode === 'people' && current ? (
            <ReplyBox key={current.id} status={current} onTyping={setTyping} />
          ) : props.mode === 'own' ? (
            <div className="flex gap-2">
              <Button fullWidth onClick={props.onChange}>
                {t.change}
              </Button>
              <Button fullWidth variant="secondary" onClick={props.onClear}>
                {t.clear}
              </Button>
            </div>
          ) : null}
        </footer>
      </motion.div>

      {props.mode === 'people' && current && (
        <ReportDialog
          open={reporting}
          onClose={() => setReporting(false)}
          targetType="status"
          targetId={current.id}
          title={t.report}
          note={t.reportNote}
        />
      )}
    </motion.div>
  )
}

// Reply: the first message of a status conversation (required). Sent once per status; after that
// the conversation lives in Chats.
function ReplyBox({ status, onTyping }: { status: LiveStatus; onTyping: (on: boolean) => void }) {
  const { dict } = useI18n()
  const t = dict.statuses
  const errorText = useErrorText()
  const [body, setBody] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const send = () =>
    startTransition(async () => {
      const result = await startStatusConversation(status.id, body)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setBody('')
      setSent(result.data.sessionId)
    })

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-2 rounded-3xl bg-white/10 p-3 text-center backdrop-blur">
        <p className="text-sm">{t.replySent}</p>
        <LocaleLink
          href={`/blind-date/${sent}`}
          className="text-callout rounded-full bg-white px-4 py-2 font-semibold text-black active:scale-[0.97]"
        >
          {t.openChat}
        </LocaleLink>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (body.trim() && !pending) send()
      }}
    >
      <p className="text-footnote px-1 text-pretty text-white/70">{t.replyHint}</p>
      {error && (
        <p role="alert" className="px-1 text-sm text-red-300">
          {errorText(error)}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
          maxLength={1000}
          enterKeyHint="send"
          placeholder={fmt(t.replyPlaceholder, { name: status.name })}
          aria-label={fmt(t.replyPlaceholder, { name: status.name })}
          className="h-12 min-w-0 flex-1 rounded-full border border-white/25 bg-black/40 px-4 text-base text-white backdrop-blur outline-none placeholder:text-white/60 focus:border-white/60"
        />
        <button
          type="submit"
          aria-label={dict.common.send}
          disabled={!body.trim() || pending}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition-[transform,scale,opacity] duration-150 ease-out active:scale-[0.94] disabled:opacity-40"
        >
          <Send className="size-5" />
        </button>
      </div>
    </form>
  )
}
