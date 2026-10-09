'use client'

import { Sparkles } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { useReferralCard } from './use-referral-card'

// The matchmaker's note pinned as the first message of the new chat (kind 'system').
export function SystemNote({ referralId, body }: { referralId: string; body: string | null }) {
  const { dict } = useI18n()
  const t = dict.matchmaker
  const { card } = useReferralCard(referralId)
  const title = card?.matchmakerName
    ? fmt(t.pinnedTitle, { name: card.matchmakerName })
    : t.pinnedTitleAnon
  return (
    <div className="card-raised mx-auto flex w-full max-w-[22rem] flex-col gap-2 p-4 text-center">
      <span className="text-accent flex items-center justify-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4" aria-hidden />
        {title}
      </span>
      {body && (
        <p className="text-[16px] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap">
          {body}
        </p>
      )}
      <p className="text-muted text-footnote">{t.pinnedHint}</p>
    </div>
  )
}
