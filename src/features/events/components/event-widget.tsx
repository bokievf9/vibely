'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { ArrowRight, CalendarHeart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { remindEvent } from '../actions'
import { formatCountdown } from '../countdown'
import type { CurrentEvent } from '../types'
import { useCurrentEvent } from './use-current-event'

type CardProps = {
  event: CurrentEvent
  live: boolean
  msLeft: number
  setReminded: (on: boolean) => void
  onEnter: () => void
  /** Discover only: a hide button in the corner. */
  onHide?: () => void
  className?: string
}

// Presentational countdown / live card for a Blind Dating Night (state comes from
// useCurrentEvent, owned by the screen that renders it).
export function EventCard({
  event,
  live,
  msLeft,
  setReminded,
  onEnter,
  onHide,
  className,
}: CardProps) {
  const { dict, locale } = useI18n()
  const t = dict.events
  const errorText = useErrorText()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<ErrorKey>()

  const toggleRemind = () => {
    const next = !event.reminded
    setReminded(next)
    startTransition(async () => {
      const result = await remindEvent(event.id, next)
      if (!result.ok) {
        setReminded(!next)
        setError(result.error)
      } else setError(undefined)
    })
  }

  const countdown = formatCountdown(msLeft, {
    in: t.in,
    days: t.days,
    hours: t.hours,
    minutes: t.minutes,
    startingNow: t.startingNow,
  })

  return (
    <section
      aria-label={t.kicker}
      className={cn('card animate-rise relative overflow-hidden px-4 pt-4 pb-3', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 h-32 bg-[radial-gradient(60%_70%_at_20%_30%,rgb(255_77_125/0.22),transparent)]"
      />
      <div className="relative flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            live ? 'btn-accent' : 'bg-accent/12 text-accent',
          )}
        >
          <CalendarHeart className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption text-accent flex items-center gap-1.5 font-semibold tracking-wide uppercase">
            {live && <LiveDot />}
            {live ? t.liveNow : t.kicker}
          </p>
          <h3 className="text-headline mt-0.5 truncate">{event.title[locale]}</h3>
          <p className="text-muted text-footnote mt-0.5 truncate">
            {event.theme ? `${event.theme} · ` : ''}
            {live ? peopleInRoom(event.inRoom, t) : fmt(t.startsIn, { time: countdown })}
          </p>
        </div>
        {onHide && (
          <button
            type="button"
            aria-label={t.hide}
            onClick={onHide}
            className="text-muted active:bg-fill -mt-1.5 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {live ? (
        <div className="relative mt-3">
          <Button size="sm" className="h-11 w-full" onClick={onEnter}>
            {t.enter} <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="relative mt-3 flex items-center justify-between gap-3">
          <span className="text-footnote text-pretty">
            {error ? (
              <span className="text-danger">{errorText(error)}</span>
            ) : event.reminded ? (
              <span className="text-muted">{t.reminded}</span>
            ) : (
              <span className="font-medium">{t.remind}</span>
            )}
          </span>
          <Switch
            checked={event.reminded}
            onToggle={toggleRemind}
            label={t.remind}
            disabled={pending}
          />
        </div>
      )}
    </section>
  )
}

export function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span className="bg-accent absolute inline-flex size-full animate-ping rounded-full opacity-60" />
      <span className="bg-accent relative inline-flex size-2 rounded-full" />
    </span>
  )
}

export function peopleInRoom(count: number, t: { inRoom: string; inRoomOne: string; inRoomNone: string }) {
  return count === 0 ? t.inRoomNone : count === 1 ? t.inRoomOne : fmt(t.inRoom, { count })
}

// Hidden nights are remembered per device (a convenience, never state): one key per night and
// phase, so a countdown that was hidden still announces itself once it goes live. Read through
// useSyncExternalStore: the server snapshot is "shown", the client's is the stored flag, so there
// is no hydration mismatch and no flash.
const hiddenKey = (id: string, live: boolean) =>
  `vibely:event-hidden:${id}:${live ? 'live' : 'soon'}`
const listeners = new Set<() => void>()
const subscribeHidden = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}
const readHidden = (key: string) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const writeHidden = (key: string) => {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Private mode or blocked storage: nothing remembered.
  }
  listeners.forEach((l) => l())
}

// Self-contained widget for Discover: keeps the night fresh, hides per night, Enter navigates to
// Blind Dating and joins the room there. Renders nothing once the night is over.
export function EventWidget({ initial, className }: { initial: CurrentEvent; className?: string }) {
  const router = useLocaleRouter()
  const { event, live, msLeft, setReminded } = useCurrentEvent(initial)
  const key = event ? hiddenKey(event.id, live) : ''
  const hidden = useSyncExternalStore(
    subscribeHidden,
    () => (key ? readHidden(key) : false),
    () => false,
  )
  // Hidden for this view even when storage is unavailable.
  const [hiddenHere, setHiddenHere] = useState<string | null>(null)

  if (!event || hidden || hiddenHere === key) return null

  const hide = () => {
    setHiddenHere(key)
    writeHidden(key)
  }

  return (
    <EventCard
      event={event}
      live={live}
      msLeft={msLeft}
      setReminded={setReminded}
      onEnter={() => router.push('/blind-date?event=1')}
      onHide={hide}
      className={className}
    />
  )
}
