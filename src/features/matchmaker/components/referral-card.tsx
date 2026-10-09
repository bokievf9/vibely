'use client'

import { useState, useTransition } from 'react'
import { HeartHandshake, Quote } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/i18n/config'
import { LocaleLink, useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { formatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { decideReferral } from '../actions'
import { canDecide, cardCopy, cardPerson } from '../card'
import type { ReferralCard as Card } from '../types'
import { useReferralCard } from './use-referral-card'

type Props = {
  referralId: string
  // The other participant of the chat this card sits in.
  partnerId: string
  partnerName: string
  // The viewer is the matchmaker (the card is their own message).
  mine: boolean
  at: string
}

// An introduction in the chat: who, the matchmaker's note, Interested / No thanks. Decisions
// apply at once and roll back on error. Nothing here ever shows a decline of the other person.
export function ReferralCard({ referralId, partnerId, partnerName, at }: Props) {
  const { dict, locale } = useI18n()
  const t = dict.matchmaker
  const errorText = useErrorText()
  const { card, loading, update } = useReferralCard(referralId)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const decide = (current: Card, interested: boolean) => {
    if (current.role === 'matchmaker') return
    update({ ...current, state: interested ? 'interested' : 'closed' })
    startTransition(async () => {
      const result = await decideReferral({ referralId, interested })
      if (!result.ok) {
        update(current)
        return setError(result.error)
      }
      setError(undefined)
      update({ ...current, state: result.data.state, matchId: result.data.matchId })
    })
  }

  return (
    <div className="card mx-auto flex w-full max-w-[22rem] flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="icon-tile text-accent">
          <HeartHandshake className="size-[1.125rem]" aria-hidden />
        </span>
        <span className="text-headline min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-4 w-40" />
          ) : card ? (
            cardCopy(t, card, partnerName).title
          ) : (
            t.unavailable
          )}
        </span>
      </div>
      {loading && (
        <div className="flex items-center gap-3" aria-label={t.cardLoading}>
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      )}
      {card && <Body card={card} partnerId={partnerId} partnerName={partnerName} />}
      {card && canDecide(card) && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" loading={pending} onClick={() => decide(card, true)}>
            {t.interested}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={pending}
            onClick={() => decide(card, false)}
          >
            {t.noThanks}
          </Button>
        </div>
      )}
      {card && card.role !== 'matchmaker' && card.state === 'matched' && card.matchId && (
        <LocaleLink
          href={`/chats/${card.matchId}`}
          className="btn-accent flex h-10 items-center justify-center rounded-2xl text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          {t.openChat}
        </LocaleLink>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {errorText(error)}
        </p>
      )}
      <time dateTime={at} className="text-muted self-end text-[11px] font-medium tabular-nums">
        {formatTime(at, locale)}
      </time>
    </div>
  )
}

function Body({
  card,
  partnerId,
  partnerName,
}: {
  card: Card
  partnerId: string
  partnerName: string
}) {
  const { dict } = useI18n()
  const t = dict.matchmaker
  const person = cardPerson(card, partnerId)
  const { status } = cardCopy(t, card, partnerName)
  const noteBy = card.role === 'matchmaker' ? dict.chats.yourself : card.matchmakerName
  return (
    <>
      {person && (
        <div className="flex items-center gap-3">
          <Avatar
            photo={person.photo}
            alt={person.name}
            size={56}
            className="ring-1 ring-white/10"
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-headline truncate">
              {person.name}, {person.age}
            </span>
          </span>
        </div>
      )}
      {card.note && (
        <blockquote className="bg-fill/60 flex gap-2 rounded-2xl px-3 py-2.5 text-[15px] leading-snug">
          <Quote className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted text-caption font-semibold uppercase">
              {fmt(t.noteFrom, { name: noteBy })}
            </span>
            <span className="[overflow-wrap:anywhere] whitespace-pre-wrap">{card.note}</span>
          </span>
        </blockquote>
      )}
      {status && (
        <p
          className={cn(
            'text-sm',
            card.state === 'matched' ? 'text-success font-semibold' : 'text-muted',
          )}
        >
          {status}
        </p>
      )}
    </>
  )
}
