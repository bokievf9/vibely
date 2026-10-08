'use client'

import { Eye, MessageCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { LocaleLink, useI18n } from '@/i18n/client'
import type { RandomSession } from '../types'

type Props = {
  session: RandomSession
  pending: boolean
  // The chat has ended: the panel keeps its place but can no longer be used.
  disabled?: boolean
  onReveal: () => void
}

// Mutual consent: nothing is shown until both people press the button.
export function RevealPanel({ session, pending, disabled = false, onReveal }: Props) {
  const { dict } = useI18n()
  const { partner, matchId, myRevealed, partnerRevealed } = session

  if (partner) {
    return (
      <div className="bg-accent/10 flex items-center gap-3 rounded-2xl p-3">
        <Avatar photo={partner.photo} alt={partner.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 font-semibold">
            <span className="truncate">
              {partner.name}, {partner.age}
            </span>
            <VerifiedBadge size={16} />
          </p>
          {(partner.jobTitle || partner.relationshipGoal) && (
            <p className="text-muted truncate text-xs">
              {[
                partner.jobTitle,
                partner.relationshipGoal && dict.about.goal.options[partner.relationshipGoal],
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <p className="text-accent text-xs">{dict.random.revealed}</p>
        </div>
        {matchId && (
          <LocaleLink
            href={`/chats/${matchId}`}
            className="bg-accent text-accent-foreground flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold transition-transform duration-150 active:scale-[0.97]"
          >
            <MessageCircle className="size-4" /> {dict.random.openChat}
          </LocaleLink>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface flex flex-col gap-2 rounded-2xl p-3">
      <p className="text-muted text-xs">
        {myRevealed
          ? dict.random.revealWaiting
          : partnerRevealed
            ? dict.random.partnerWantsReveal
            : dict.random.revealHint}
      </p>
      {!myRevealed && (
        <Button
          size="sm"
          className="h-11"
          variant={partnerRevealed ? 'primary' : 'secondary'}
          loading={pending}
          disabled={disabled}
          onClick={onReveal}
        >
          <Eye className="size-4" /> {dict.random.reveal}
        </Button>
      )}
    </div>
  )
}
