'use client'

import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Heart, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { haptic } from '@/lib/haptics'
import { Immersive } from '@/components/layout/immersive'
import type { DuoPerson } from '../types'
import { DuoPhotos } from './duo-photos'

export type DuoMatchInfo = { groupId: string; ours: DuoPerson[]; theirs: DuoPerson[] }

const POP = { type: 'spring', bounce: 0.3, duration: 0.6 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const

// Full-screen "It's a duo match!": both duos, then the 4-person group chat or back to the deck.
export function DuoMatchModal({
  match,
  onClose,
}: {
  match: DuoMatchInfo | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {match && <Celebration key={match.groupId} match={match} onClose={onClose} />}
    </AnimatePresence>
  )
}

function Celebration({ match, onClose }: { match: DuoMatchInfo; onClose: () => void }) {
  const { dict } = useI18n()
  const t = dict.duo
  const router = useLocaleRouter()
  const reduce = useReducedMotion() ?? false
  const titleId = useId()
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    haptic('success')
    primary.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const side = (sign: -1 | 1, delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } }
      : {
          initial: { opacity: 0, x: sign * 60, rotate: 0 },
          animate: { opacity: 1, x: 0, rotate: sign * 3, transition: { ...POP, delay } },
        }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-immersive
      className="bg-background/95 fixed inset-0 z-50 flex justify-center backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
    >
      <Immersive />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(60%_45%_at_50%_30%,rgb(255_77_125/0.18),transparent)]"
      />
      <div className="relative flex w-full max-w-md flex-col">
        <div className="flex flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
          <div className="relative flex w-full flex-col items-center gap-3">
            <motion.div className="w-[78%]" {...side(-1, 0.05)}>
              <DuoPhotos
                members={match.ours}
                sizes="160px"
                className="border-background aspect-[2/1.2] overflow-hidden rounded-3xl border-4 shadow-2xl shadow-black/50"
              />
            </motion.div>
            <motion.span
              aria-hidden
              className="bg-accent-gradient text-accent-foreground ring-background z-10 -my-8 flex size-14 items-center justify-center rounded-full shadow-lg ring-4"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { ...POP, delay: 0.2 } }}
            >
              <Heart className="size-7 fill-current" />
            </motion.span>
            <motion.div className="w-[78%]" {...side(1, 0.12)}>
              <DuoPhotos
                members={match.theirs}
                sizes="160px"
                className="border-background aspect-[2/1.2] overflow-hidden rounded-3xl border-4 shadow-2xl shadow-black/50"
              />
            </motion.div>
          </div>
          <h2
            id={titleId}
            className="mt-6 text-center text-[2.25rem] leading-[1.1] font-bold tracking-[-0.035em]"
          >
            {t.matchTitle}
          </h2>
          <p className="text-muted mt-2 max-w-xs text-center text-base">{t.matchText}</p>
        </div>
        <div className="flex flex-col gap-2 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            ref={primary}
            fullWidth
            onClick={() => router.push(`/chats/group/${match.groupId}`)}
          >
            <MessageCircle className="size-5" aria-hidden /> {t.openGroup}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            {t.keepBrowsing}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
