'use client'

import { useEffect, useId, useRef } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { Heart, MessageCircle, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { Immersive } from '@/components/layout/immersive'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { haptic } from '@/lib/haptics'
import { useOwnAvatar } from '@/features/profile/own-avatar'
import type { BlindSession } from '../types'
import { AliasAvatar } from './alias-avatar'

const POP = { type: 'spring', bounce: 0.3, duration: 0.6 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const

type Props = { session: BlindSession; onNext: () => void }

// Both pressed Connect: the gradient placeholders turn into real photos, then name and age.
// Profile data only reaches the browser at this point (get_blind_session after the match).
export function RevealScreen({ session, onNext }: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const router = useLocaleRouter()
  const reduce = useReducedMotion() ?? false
  const ownPhoto = useOwnAvatar()
  const titleId = useId()
  const primary = useRef<HTMLButtonElement>(null)
  const { partner, matchId } = session

  useEffect(() => {
    haptic('success')
    primary.current?.focus({ preventScroll: true })
  }, [])

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2, delay } } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT, delay } },
        }

  const details = partner
    ? [
        partner.jobTitle,
        partner.relationshipGoal && dict.about.goal.options[partner.relationshipGoal],
        partner.city,
      ].filter(Boolean)
    : []

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-immersive
      className="bg-background/95 fixed inset-0 z-50 flex justify-center backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } }}
    >
      <Immersive />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(60%_45%_at_50%_30%,rgb(255_77_125/0.2),transparent)]"
      />
      <div className="relative flex w-full max-w-md flex-col">
        <div className="flex flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
          <div className="relative flex h-60 w-full shrink-0 items-center justify-center">
            <RevealCard side="left" reduce={reduce} alias={session.myAlias} src={ownPhoto} />
            <RevealCard
              side="right"
              reduce={reduce}
              alias={session.partnerAlias}
              src={partner?.photo?.url ?? null}
              name={partner?.name}
            />
            <motion.span
              aria-hidden
              className="bg-accent text-accent-foreground ring-background absolute top-1/2 left-1/2 z-10 -mt-7 -ml-7 flex size-14 items-center justify-center rounded-full shadow-lg ring-4"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { ...POP, delay: 0.5 } }}
            >
              <Heart className="size-7 fill-current" />
            </motion.span>
          </div>
          <motion.p
            className="text-accent mt-6 text-sm font-semibold tracking-wide uppercase"
            {...rise(0.55)}
          >
            {fmt(t.partner, { n: session.partnerAlias })}
          </motion.p>
          <motion.h2
            id={titleId}
            className="mt-1 text-center text-4xl leading-tight font-bold tracking-tight"
            {...rise(0.6)}
          >
            {t.revealTitle}
          </motion.h2>
          {partner ? (
            <motion.div className="mt-3 flex flex-col items-center gap-1" {...rise(0.68)}>
              <p className="flex max-w-full items-center gap-1.5 text-xl font-semibold">
                <span className="truncate">
                  {partner.name}, {partner.age}
                </span>
                <VerifiedBadge size={18} />
              </p>
              {details.length > 0 && (
                <p className="text-muted text-center text-sm">{details.join(' · ')}</p>
              )}
            </motion.div>
          ) : null}
          <motion.p
            className="text-muted mt-4 max-w-xs text-center text-base text-pretty"
            {...rise(0.74)}
          >
            {t.revealText} {t.revealChatHint}
          </motion.p>
        </div>
        <motion.div
          className="flex flex-col gap-2 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          {...rise(0.7)}
        >
          {matchId && (
            <Button ref={primary} fullWidth onClick={() => router.push(`/chats/${matchId}`)}>
              <MessageCircle className="size-5" aria-hidden /> {t.openChat}
            </Button>
          )}
          <Button variant="ghost" fullWidth onClick={onNext}>
            {t.next}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Tilted card: starts as the gradient alias, then the real photo fades in over it.
function RevealCard({
  src,
  alias,
  side,
  reduce,
  name,
}: {
  src: string | null
  alias: number
  side: 'left' | 'right'
  reduce: boolean
  name?: string
}) {
  const sign = side === 'left' ? -1 : 1
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
      <AliasAvatar alias={alias} size={0} className="absolute inset-0 rounded-none" />
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: reduce ? 0.2 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : 0.35 },
        }}
      >
        {src ? (
          <Image src={src} alt={name ?? ''} fill sizes="144px" className="object-cover" />
        ) : (
          <span className="text-foreground/80 flex size-full items-center justify-center">
            <UserRound className="size-12" />
          </span>
        )}
      </motion.div>
    </motion.div>
  )
}
