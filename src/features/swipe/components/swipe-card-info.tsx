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
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(to_top,rgb(10_6_10/0.96)_0%,rgb(10_6_10/0.82)_28%,rgb(10_6_10/0.45)_58%,transparent_100%)]"
      />
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-0 bg-[rgb(10_6_10/0.88)] backdrop-blur-md"
      />
      <motion.div
        layoutScroll
        data-no-drag={open || undefined}
        className={cn(
          'absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-2 px-5 pt-5 pb-6 text-white',
          open
            ? 'pointer-events-auto max-h-[85%] touch-pan-y overflow-y-auto overscroll-contain'
            : 'pointer-events-none',
        )}
      >
        <motion.div layout="position" className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] [overflow-wrap:anywhere] [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">
            {candidate.name},{' '}
            {/* Age and badge stay together, so the badge never wraps onto a line of its own. */}
            <span className="whitespace-nowrap">
              <span className="font-light text-white/90">{candidate.age}</span>
              <VerifiedBadge size={24} className="ml-1.5 align-[-0.1em]" />
            </span>
          </h2>
          {hasMore && (
            <button
              type="button"
              data-no-drag
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="glass pointer-events-auto relative mt-1 flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition-[transform,scale,background-color] duration-150 ease-out before:absolute before:-inset-x-1 before:-inset-y-1 active:scale-[0.96] active:bg-white/25"
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
            className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium text-white/85"
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
                  className="glass flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
                >
                  <Icon className="size-4 shrink-0 text-white/80" aria-hidden />
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
              'text-[15px] leading-snug [overflow-wrap:anywhere] text-white/85',
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
              <li
                key={slug}
                className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-white/90"
              >
                {dict.tags[slug] ?? slug}
              </li>
            ))}
          </motion.ul>
        )}
      </motion.div>
    </MotionConfig>
  )
}
