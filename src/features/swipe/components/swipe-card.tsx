'use client'

import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import type { Candidate } from '../schemas'
import { SwipeCardInfo } from './swipe-card-info'

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
  // false: a static preview ("How others see me").
  draggable?: boolean
}

export function SwipeCard({ candidate, active, onSwipe, draggable = true }: Props) {
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
      drag={active && draggable ? 'x' : false}
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      initial={{ scale: active ? 1 : 0.95, opacity: 0 }}
      animate={{ scale: active ? 1 : 0.95, opacity: 1 }}
      variants={exitVariants}
      exit="exit"
      aria-hidden={!active}
    >
      <PhotoCarousel photos={candidate.photos} alt={candidate.name} priority={active} />
      {candidate.secondChance && (
        <span className="pointer-events-none absolute top-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <RotateCcw className="size-3.5" aria-hidden /> {dict.discover.secondChance}
        </span>
      )}
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
      <SwipeCardInfo candidate={candidate} />
    </motion.article>
  )
}
