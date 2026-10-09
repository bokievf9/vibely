'use client'

import { useState } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import type { SentNote } from '../types'
import { LikeNoteSheet, type NoteAccess } from './like-note-sheet'

// Profile view (search, crossed paths, "Who viewed you"): "Like with a note" under the Like
// button, or the note the viewer already sent to this person.
export function ProfileNote({
  userId,
  sent,
  access,
}: {
  userId: string
  sent: SentNote | null
  access: NoteAccess | null
}) {
  const { dict } = useI18n()
  const t = dict.vipPerks.note
  const router = useLocaleRouter()
  const [open, setOpen] = useState(false)

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
  if (!access) return null
  return (
    <>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        <MessageSquareHeart className="text-accent size-5" aria-hidden />
        {t.button}
      </Button>
      {open && (
        <LikeNoteSheet
          open
          targetId={userId}
          access={access}
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
