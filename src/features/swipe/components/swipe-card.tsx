'use client'

import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import type { Candidate } from '../schemas'

const SWIPE_THRESHOLD_PX = 110

// The deck passes the swipe direction through <AnimatePresence custom>, so buttons fly the right way too.
const exitVariants = {
  exit: (direction: 'like' | 'pass') => ({
    x: direction === 'like' ? 600 : -600,
    opacity: 0,
    transition: { duration: 0.25 },
  }),
}

type Props = {
  candidate: Candidate
  active: boolean
  onSwipe: (direction: 'like' | 'pass') => void
}

export function SwipeCard({ candidate, active, onSwipe }: Props) {
  const { dict } = useI18n()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-18, 18])
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD_PX], [0, 1])
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD_PX, -20], [1, 0])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD_PX || info.velocity.x > 600) onSwipe('like')
    else if (info.offset.x < -SWIPE_THRESHOLD_PX || info.velocity.x < -600) onSwipe('pass')
  }

  return (
    <motion.article
      className="bg-surface absolute inset-0 overflow-hidden rounded-3xl shadow-xl"
      style={{ x, rotate }}
      drag={active ? 'x' : false}
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      initial={{ scale: active ? 1 : 0.95, opacity: 0 }}
      animate={{ scale: active ? 1 : 0.95, opacity: 1 }}
      variants={exitVariants}
      exit="exit"
      aria-hidden={!active}
    >
      <PhotoCarousel photos={candidate.photos} alt={candidate.name} priority={active} />
      <motion.span
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-6 -rotate-12 rounded-xl border-4 border-emerald-400 px-3 py-1 text-3xl font-black text-emerald-400"
      >
        LIKE
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="absolute top-8 right-6 rotate-12 rounded-xl border-4 border-red-400 px-3 py-1 text-3xl font-black text-red-400"
      >
        NOPE
      </motion.span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 pt-20 text-white">
        <h2 className="text-3xl font-bold">
          {candidate.name}, <span className="font-normal">{candidate.age}</span>
        </h2>
        {(candidate.city || candidate.distanceKm !== null) && (
          <p className="flex items-center gap-1 text-sm text-white/80">
            <MapPin className="size-4" aria-hidden />
            {[
              candidate.city,
              candidate.distanceKm !== null && fmt(dict.swipe.km, { km: candidate.distanceKm }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {candidate.bio && <p className="line-clamp-2 text-sm text-white/90">{candidate.bio}</p>}
        {candidate.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {candidate.tags.slice(0, 5).map((slug) => (
              <li key={slug} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                {dict.tags[slug] ?? slug}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.article>
  )
}
