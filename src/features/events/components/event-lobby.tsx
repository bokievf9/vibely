'use client'

import { CalendarHeart, Crown, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { useAccess } from '@/features/plans/components/access-provider'
import type { CurrentEvent } from '../types'
import { LiveDot, peopleInRoom } from './event-widget'

// Live lobby banner on the Blind Dating waiting screen: which night, how many people are in the
// room right now, and that tonight's pairing uses the relaxed filters.
export function EventLobbyBanner({
  event,
  className,
}: {
  event: CurrentEvent
  className?: string
}) {
  const { dict, locale } = useI18n()
  const t = dict.events
  const people = peopleInRoom(event.inRoom, t)
  return (
    <section aria-live="polite" className={cn('card px-4 py-3 text-left', className)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="bg-accent/12 text-accent flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <CalendarHeart className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-headline truncate">
            {fmt(t.youAreIn, { title: event.title[locale] })}
          </p>
          <p className="text-muted text-footnote flex items-center gap-1.5">
            <LiveDot />
            {people}
          </p>
        </div>
      </div>
      <p className="text-muted text-footnote mt-2 text-pretty">{t.relaxedFilters}</p>
      <EventPriorityLine />
    </section>
  )
}

// event_priority (VIP) only changes the queue order, so it has no button of its own: one line
// says who goes first, and without it a tap opens the upgrade sheet.
function EventPriorityLine() {
  const { dict } = useI18n()
  const t = dict.plans.entry
  const { has, showUpgrade, access } = useAccess()
  if (!access.available) return null
  if (has('event_priority'))
    return (
      <p className="text-vip text-footnote mt-2 flex items-center gap-1.5 font-medium">
        <Crown className="fill-vip/25 size-3.5 shrink-0" aria-hidden />
        {t.eventPriorityOn}
      </p>
    )
  return (
    <button
      type="button"
      onClick={() => showUpgrade({ feature: 'event_priority', reason: 'feature' })}
      className="text-muted text-footnote relative mt-2 flex items-center gap-1.5 text-left before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] active:opacity-60"
    >
      <Crown className="text-vip fill-vip/25 size-3.5 shrink-0" aria-hidden />
      <span className="text-pretty">{t.eventPriorityLocked}</span>
    </button>
  )
}

// Shown in place of the chat or waiting room once the night is over.
export function EventEndedCard({ onBack }: { onBack: () => void }) {
  const { dict } = useI18n()
  const t = dict.events
  return (
    <div
      role="status"
      className="animate-rise flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center"
    >
      <span
        aria-hidden
        className="bg-accent/12 text-accent flex size-16 items-center justify-center rounded-full"
      >
        <Moon className="size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-title2">{t.endedTitle}</h2>
        <p className="text-muted max-w-xs text-pretty">{t.endedText}</p>
      </div>
      <Button className="w-full max-w-xs" onClick={onBack}>
        {t.endedButton}
      </Button>
    </div>
  )
}
