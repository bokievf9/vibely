'use client'

import { useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ChevronUp, MapPin } from 'lucide-react'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import {
  AboutDetails,
  aboutBadges,
  aboutRows,
  PromptCards,
} from '@/features/profile/components/about-details'
import { cn } from '@/lib/utils'
import type { Candidate } from '../schemas'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
// Blocks that stay on screen slide to their new spot; new blocks fade up into place.
const MOVE = { type: 'spring', bounce: 0, duration: 0.35 } as const
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
}

// Bottom of the swipe card: name, place, a few badges; "More" opens prompts and all details.
export function SwipeCardInfo({ candidate }: { candidate: Candidate }) {
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)
  const badges = aboutBadges(candidate.about, dict.about)
  const hasMore =
    candidate.prompts.length > 0 ||
    aboutRows(candidate.about, dict.about).length > badges.length ||
    Boolean(candidate.bio && candidate.bio.length > 90) ||
    candidate.tags.length > 5

  return (
    // reducedMotion="user": layout slides and the fade-up drop their movement, opacity stays.
    <MotionConfig reducedMotion="user" transition={MOVE}>
      {/* Two background layers crossfade instead of the panel snapping between styles. */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: open ? 0 : 1 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
      />
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-0 bg-black/85"
      />
      <motion.div
        layoutScroll
        data-no-drag={open || undefined}
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5 text-white',
          open
            ? 'pointer-events-auto max-h-[85%] touch-pan-y overflow-y-auto overscroll-contain'
            : 'pointer-events-none',
        )}
      >
        <motion.div layout="position" className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-3xl leading-tight font-bold [overflow-wrap:anywhere]">
            {candidate.name},{' '}
            {/* Age and badge stay together, so the badge never wraps onto a line of its own. */}
            <span className="whitespace-nowrap">
              <span className="font-normal">{candidate.age}</span>
              <VerifiedBadge size={24} className="ml-1.5 align-[-0.1em]" />
            </span>
          </h2>
          {hasMore && (
            <button
              type="button"
              data-no-drag
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="pointer-events-auto relative mt-1 flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 text-sm font-medium backdrop-blur-sm transition-[transform,scale,background-color] duration-150 ease-out before:absolute before:-inset-x-1 before:-inset-y-1.5 active:scale-[0.96] active:bg-white/30"
            >
              {open ? dict.about.less : dict.about.more}
              <ChevronUp
                className={cn(
                  'size-4 transition-transform duration-200 ease-out',
                  open && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          )}
        </motion.div>
        {(candidate.city || candidate.distanceKm !== null) && (
          <motion.p
            layout="position"
            className="flex min-w-0 items-center gap-1 text-sm text-white/80"
          >
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {[
                candidate.city,
                candidate.distanceKm !== null && fmt(dict.swipe.km, { km: candidate.distanceKm }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </motion.p>
        )}
        <AnimatePresence initial={false} mode="popLayout">
          {!open && badges.length > 0 && (
            <motion.ul key="badges" {...reveal} className="flex flex-wrap gap-1.5">
              {badges.map(({ icon: Icon, label, value }) => (
                <li
                  key={label}
                  className="flex max-w-full items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium"
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{value}</span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        {candidate.bio && (
          <motion.p
            layout="position"
            className={cn(
              'text-sm [overflow-wrap:anywhere] text-white/90',
              open ? 'whitespace-pre-wrap' : 'line-clamp-2',
            )}
          >
            {candidate.bio}
          </motion.p>
        )}
        <AnimatePresence initial={false} mode="popLayout">
          {open && (
            <motion.div key="details" {...reveal} className="flex flex-col gap-3 pt-2">
              <PromptCards prompts={candidate.prompts} t={dict.about} tone="dark" />
              <AboutDetails about={candidate.about} t={dict.about} tone="dark" />
            </motion.div>
          )}
        </AnimatePresence>
        {candidate.tags.length > 0 && (
          <motion.ul layout="position" className="flex flex-wrap gap-1.5 pt-1">
            {(open ? candidate.tags : candidate.tags.slice(0, 5)).map((slug) => (
              <li key={slug} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                {dict.tags[slug] ?? slug}
              </li>
            ))}
          </motion.ul>
        )}
      </motion.div>
    </MotionConfig>
  )
}
