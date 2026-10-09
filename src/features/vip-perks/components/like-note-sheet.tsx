'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Heart, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { isRisky } from '@/features/safety/risk'
import { sendLikeNote, type NoteResult } from '../actions'
import { NOTE_MAX } from '../types'
import { PerkUpsell } from './perk-upsell'

// Who may write a note: on = the plan has message_before_match, left = notes left today (null:
// unlimited, staff). Null on a database without plans: the button is not shown at all.
export type NoteAccess = { on: boolean; left: number | null }

type Props = {
  open: boolean
  onClose: () => void
  targetId: string
  access: NoteAccess
  // The like and the note are stored: the caller removes the card / shows the match.
  onSent: (result: NoteResult) => void
}

// "Like with a note": a small sheet with the note (200 characters), sent together with the like.
export function LikeNoteSheet({ open, onClose, targetId, access, onSent }: Props) {
  const { dict } = useI18n()
  const t = dict.vipPerks.note
  const errorText = useErrorText()
  const [body, setBody] = useState('')
  const [error, setError] = useState<ErrorKey>()
  const [done, setDone] = useState<NoteResult | null>(null)
  const [pending, startTransition] = useTransition()
  const length = body.trim().length
  const outOfNotes = access.left !== null && access.left <= 0

  const send = () =>
    startTransition(async () => {
      const result = await sendLikeNote({ targetId, body })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setDone(result.data)
      // A match goes straight to the match screen; otherwise the sheet confirms first.
      if (result.data.matchId) onSent(result.data)
    })

  const close = () => {
    if (done && !done.matchId) onSent(done)
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title={t.title}>
      {!access.on ? (
        <PerkUpsell feature="message_before_match" title={t.upsellTitle} text={t.upsellText} />
      ) : done ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-14 text-emerald-400" aria-hidden />
          <p className="font-semibold">{t.sentTitle}</p>
          <p className="text-muted text-sm">{done.held ? t.heldHint : t.sentHint}</p>
          <Button fullWidth onClick={close}>
            {dict.common.close}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">{t.intro}</p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, NOTE_MAX))}
            maxLength={NOTE_MAX}
            placeholder={t.placeholder}
            aria-label={t.title}
            autoFocus
            enterKeyHint="send"
          />
          <div className="text-muted flex items-center justify-between px-1 text-xs tabular-nums">
            <span>{t.quota}</span>
            <span>{fmt(t.counter, { count: length })}</span>
          </div>
          {isRisky(body) && (
            <p role="note" className="flex items-start gap-1.5 px-1 text-xs text-amber-400">
              <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {t.riskHint}
            </p>
          )}
          <FormError message={errorText(outOfNotes && !error ? 'noteLimitReached' : error)} />
          <Button
            fullWidth
            onClick={send}
            loading={pending}
            disabled={length === 0 || length > NOTE_MAX || outOfNotes}
          >
            <Heart className="size-5 fill-current" aria-hidden />
            {t.send}
          </Button>
        </div>
      )}
    </Modal>
  )
}
