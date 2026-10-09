'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Heart, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FormError } from '@/components/ui/field'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { MatchModal, type MatchInfo } from '@/features/swipe/components/match-modal'
import { answerCrush, loadPendingCrush, type PendingCrush } from '../actions'

// Discover: the one-time "someone has a crush on you" sheet for a person who joined through a
// crush invite link. Loads after the deck and renders nothing unless the database has a pending
// card for a verified invitee. Any way out (Yes, No, Got it, closing the sheet) records the
// card as seen, so it never shows twice; only Yes tells the inviter anything (a match).
export function CrushCard() {
  const { dict } = useI18n()
  const t = dict.crush
  const errorText = useErrorText()
  const [crush, setCrush] = useState<PendingCrush | null>(null)
  const [open, setOpen] = useState(false)
  const [match, setMatch] = useState<MatchInfo | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  // The sheet closes once: a drag-dismiss after an answer must not record a second one.
  const answered = useRef(false)

  useEffect(() => {
    let active = true
    loadPendingCrush()
      .then((next) => {
        if (!active || !next) return
        setCrush(next)
        setOpen(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const answer = (yes: boolean | null) => {
    if (answered.current || !crush) return
    answered.current = true
    startTransition(async () => {
      const result = await answerCrush(yes)
      if (!result.ok) {
        answered.current = false
        return setError(result.error)
      }
      setOpen(false)
      if (result.data.matchId) {
        setMatch({ id: result.data.matchId, name: crush.name, photo: crush.photo?.url ?? null })
      }
    })
  }

  if (!crush) return null
  const text = crush.compatible
    ? fmt(t.cardText, { name: crush.name })
    : fmt(t.cardIncompatibleText, { name: crush.name })

  return (
    <>
      <Modal
        open={open}
        onClose={() => (pending ? undefined : answer(null))}
        title={t.cardTitle}
        footer={
          <div className="flex flex-col gap-2">
            <FormError message={errorText(error)} />
            {crush.compatible ? (
              <>
                <Button fullWidth onClick={() => answer(true)} loading={pending}>
                  <Heart className="size-5" aria-hidden /> {t.yes}
                </Button>
                <Button variant="ghost" fullWidth onClick={() => answer(false)} disabled={pending}>
                  {t.no}
                </Button>
              </>
            ) : (
              <Button variant="secondary" fullWidth onClick={() => answer(null)} loading={pending}>
                {t.gotIt}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 pt-2 pb-3 text-center">
          <span className="relative flex size-32 items-center justify-center">
            <span
              aria-hidden
              className="from-accent/25 to-accent/0 absolute -inset-4 rounded-full bg-radial"
            />
            <span className="bg-surface ring-background relative size-28 overflow-hidden rounded-full shadow-lg ring-4">
              {crush.photo ? (
                <Image
                  src={crush.photo.url}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                  priority
                />
              ) : (
                <span className="text-muted flex size-full items-center justify-center">
                  <UserRound className="size-12" aria-hidden />
                </span>
              )}
            </span>
            <span
              aria-hidden
              className="bg-accent-gradient text-accent-foreground ring-surface-raised absolute right-1 bottom-1 flex size-10 items-center justify-center rounded-full shadow-md ring-4"
            >
              <Heart className="size-5 fill-current" />
            </span>
          </span>
          <p className="text-body max-w-xs text-pretty [overflow-wrap:anywhere]">{text}</p>
          <p className="text-muted text-footnote max-w-xs text-pretty">
            {crush.compatible ? t.cardPrivate : t.cardIncompatibleHint}
          </p>
        </div>
      </Modal>
      <MatchModal match={match} onClose={() => setMatch(null)} />
    </>
  )
}
