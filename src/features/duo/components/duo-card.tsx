'use client'

import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import type { DuoCandidate } from '../types'
import { DuoPhotos } from './duo-photos'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// One duo in the Duo deck: both main photos, names and ages, the duo bio (only when it passed the
// risk check) and the distance between the leaders. Leaves to the side it was decided on.
export const DuoCard = forwardRef<HTMLElement, { duo: DuoCandidate; exitTo: -1 | 1; top: boolean }>(
  function DuoCard({ duo, exitTo, top }, ref) {
    const { dict } = useI18n()
    const reduce = useReducedMotion() ?? false
    return (
      <motion.article
        ref={ref}
        aria-hidden={!top || undefined}
        className="card-raised absolute inset-0 flex flex-col overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/50"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{
          opacity: 1,
          scale: top ? 1 : 0.96,
          y: top ? 0 : 8,
          transition: { duration: 0.28, ease: EASE_OUT },
        }}
        // The direction comes from AnimatePresence `custom`: the leaving card never re-renders.
        custom={exitTo}
        variants={{
          leave: (dir: number) =>
            reduce
              ? { opacity: 0, transition: { duration: 0.15 } }
              : {
                  opacity: 0,
                  x: dir * 320,
                  rotate: dir * 10,
                  transition: { duration: 0.32, ease: EASE_OUT },
                },
        }}
        exit="leave"
        style={{ zIndex: top ? 2 : 1 }}
      >
        <DuoPhotos members={duo.members} className="min-h-0 flex-1" priority={top} />
        <div className="flex flex-col gap-1.5 px-4 pt-3 pb-4">
          {duo.bio && <p className="text-callout [overflow-wrap:anywhere]">{duo.bio}</p>}
          {duo.distanceKm !== null && (
            <p className="text-muted flex items-center gap-1 text-sm">
              <MapPin className="size-4" aria-hidden />
              {fmt(dict.duo.kmAway, { km: Math.max(1, duo.distanceKm) })}
            </p>
          )}
        </div>
      </motion.article>
    )
  },
)
