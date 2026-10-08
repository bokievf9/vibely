'use client'

import { Eye, MessageCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LocaleLink, useI18n } from '@/i18n/client'
import type { RandomSession } from '../types'

type Props = { session: RandomSession; pending: boolean; onReveal: () => void }

// Mutual consent: nothing is shown until both people press the button.
export function RevealPanel({ session, pending, onReveal }: Props) {
  const { dict } = useI18n()
  const { partner, matchId, myRevealed, partnerRevealed } = session

  if (partner) {
    return (
      <div className="bg-accent/10 flex items-center gap-3 rounded-2xl p-3">
        <Avatar photo={partner.photo} alt={partner.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {partner.name}, {partner.age}
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
            className="bg-accent text-accent-foreground flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-semibold"
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
          variant={partnerRevealed ? 'primary' : 'secondary'}
          loading={pending}
          onClick={onReveal}
        >
          <Eye className="size-4" /> {dict.random.reveal}
        </Button>
      )}
    </div>
  )
}
