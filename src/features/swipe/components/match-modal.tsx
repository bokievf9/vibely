'use client'

import { useEffect, useId, useRef } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Heart, MessageCircle, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { haptic } from '@/lib/haptics'
import { PushSoftPrompt } from '@/features/push/components/push-soft-prompt'
import { IcebreakerList } from '@/features/icebreakers/components/icebreaker-list'
import { stashIcebreaker } from '@/features/icebreakers/stash'
import { useOwnAvatar } from '@/features/profile/own-avatar'

export type MatchInfo = { id: string; name: string; photo: string | null }

type Props = { match: MatchInfo | null; onClose: () => void }

// A rare moment, so it gets the delight budget: a little bounce, since it follows a throw.
const POP = { type: 'spring', bounce: 0.3, duration: 0.6 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const

// Full-screen "It's a match": both photos, then "Send a message" (primary) or "Keep swiping".
export function MatchModal({ match, onClose }: Props) {
  return (
    <AnimatePresence>
      {match && <Celebration key={match.id} match={match} onClose={onClose} />}
    </AnimatePresence>
  )
}

function Celebration({ match, onClose }: { match: MatchInfo; onClose: () => void }) {
  const { dict } = useI18n()
  const router = useLocaleRouter()
  const reduce = useReducedMotion() ?? false
  const ownPhoto = useOwnAvatar()
  const titleId = useId()
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    haptic('success')
    primary.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const openChat = (text?: string) => {
    if (text) stashIcebreaker(match.id, text)
    router.push(`/chats/${match.id}`)
  }

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2, delay } } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT, delay } },
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(60%_45%_at_50%_30%,rgb(255_77_125/0.18),transparent)]"
      />
      <div className="relative flex w-full max-w-md flex-col">
        <div className="flex flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
          <div className="relative flex h-60 w-full shrink-0 items-center justify-center">
            <PairPhoto src={ownPhoto} side="left" reduce={reduce} />
            <PairPhoto src={match.photo} side="right" reduce={reduce} />
            <motion.span
              aria-hidden
              className="bg-accent text-accent-foreground ring-background absolute top-1/2 left-1/2 z-10 -mt-7 -ml-7 flex size-14 items-center justify-center rounded-full shadow-lg ring-4"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { ...POP, delay: 0.18 } }}
            >
              <Heart className="size-7 fill-current" />
            </motion.span>
          </div>
          <motion.h2
            id={titleId}
            className="mt-6 text-center text-4xl leading-tight font-bold tracking-tight"
            {...rise(0.12)}
          >
            {dict.swipe.matchTitle}
          </motion.h2>
          <motion.p
            className="text-muted mt-2 max-w-xs text-center text-base [overflow-wrap:anywhere]"
            {...rise(0.18)}
          >
            {fmt(dict.swipe.matchSubtitle, { name: match.name })} {dict.discoverui.matchHint}
          </motion.p>
          <motion.div className="mt-8 flex w-full flex-col gap-4" {...rise(0.26)}>
            <IcebreakerList matchId={match.id} onPick={openChat} />
            <PushSoftPrompt />
          </motion.div>
        </div>
        <motion.div
          className="flex flex-col gap-2 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          {...rise(0.22)}
        >
          <Button ref={primary} fullWidth onClick={() => openChat()}>
            <MessageCircle className="size-5" aria-hidden /> {dict.swipe.sendMessage}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            {dict.swipe.keepSwiping}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}

function PairPhoto({
  src,
  side,
  reduce,
}: {
  src: string | null
  side: 'left' | 'right'
  reduce: boolean
}) {
  const sign = side === 'left' ? -1 : 1
  // Tilted cards that overlap in the middle; they arrive from their own side, never from scale 0.
  const rest = { opacity: 1, x: `${sign * 34}%`, rotate: sign * 8, scale: 1 }
  return (
    <motion.div
      aria-hidden
      className="bg-surface border-background absolute aspect-[3/4] w-36 overflow-hidden rounded-3xl border-4 shadow-2xl shadow-black/50"
      initial={
        reduce ? { ...rest, opacity: 0 } : { opacity: 0, x: `${sign * 70}%`, rotate: 0, scale: 0.9 }
      }
      animate={{ ...rest, transition: reduce ? { duration: 0.2 } : POP }}
    >
      {src ? (
        <Image src={src} alt="" fill sizes="144px" className="object-cover" />
      ) : (
        <span className="text-muted flex size-full items-center justify-center">
          <UserRound className="size-12" />
        </span>
      )}
    </motion.div>
  )
}
