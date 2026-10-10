'use client'

import { useState } from 'react'
import { Crown, MessageSquareHeart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { useAccess } from '@/features/plans/components/access-provider'
import type { SentNote } from '../types'
import { LikeNoteSheet } from './like-note-sheet'

// Profile view (search, crossed paths, "Who viewed you"): "Like with a note" under the Like
// button, or the note the viewer already sent to this person.
export function ProfileNote({ userId, sent }: { userId: string; sent: SentNote | null }) {
  const { dict } = useI18n()
  const t = dict.vipPerks.note
  const router = useLocaleRouter()
  const [open, setOpen] = useState(false)
  // Without message_before_match (VIP) the button opens the same upgrade sheet as other gates.
  const { has, showUpgrade } = useAccess()

  if (sent) {
    return (
      <div className="bg-surface-raised border-border flex flex-col gap-1 rounded-2xl border px-4 py-3">
        <p className="text-muted flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <MessageSquareHeart className="text-accent size-3.5" aria-hidden />
          {t.yours}
        </p>
        <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{sent.body}</p>
        {sent.held && <p className="text-muted text-sm">{t.heldHint}</p>}
      </div>
    )
  }
  return (
    <>
      <Button
        variant="secondary"
        fullWidth
        onClick={() =>
          has('message_before_match')
            ? setOpen(true)
            : showUpgrade({ feature: 'message_before_match', reason: 'feature' })
        }
      >
        <MessageSquareHeart className="text-accent size-5" aria-hidden />
        {t.button}
        {!has('message_before_match') && (
          <Crown className="text-vip fill-vip/25 size-4" aria-label={dict.plans.names.vip} />
        )}
      </Button>
      {open && (
        <LikeNoteSheet
          open
          targetId={userId}
          onClose={() => setOpen(false)}
          onSent={(result) => {
            setOpen(false)
            if (result.matchId) router.push(`/chats/${result.matchId}`)
            else router.refresh()
          }}
        />
      )}
    </>
  )
}
