'use client'

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import {
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion'
import { ChevronDown, Heart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import { SwipeCardInfo } from '@/features/swipe/components/swipe-card-info'
import { project } from '@/features/swipe/components/swipe-physics'
import type { Candidate } from '@/features/swipe/schemas'
import { Immersive } from '@/components/layout/immersive'

type Props = {
  person: Candidate
  busy: boolean
  onDecide: (direction: 'like' | 'pass') => void
  onClose: () => void
}

// Settles without overshoot; on dismiss the spring starts from the finger's release velocity.
const SHEET = { type: 'spring', bounce: 0, duration: 0.42 } as const

// Full-screen card for one person who liked the viewer: the Discover card, plus Pass / Like back.
// It rises from the bottom and can be dragged back down (from the header or the photo) to close.
export function LikeSheet({ person, busy, onDecide, onClose }: Props) {
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  const controls = useDragControls()
  // Fixed for the sheet's lifetime: it only mounts after a tap, in the browser.
  const [vh] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight))
  const y = useMotionValue(reduce ? 0 : vh)
  const backdrop = useTransform(y, [0, vh], [1, 0])
  const dragged = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const startDrag = (e: PointerEvent) => {
    if (e.target instanceof Element && e.target.closest('[data-no-drag]')) return
    controls.start(e)
  }

  // Close by where the sheet is heading, not where the finger stopped: a flick down is enough.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y + project(info.velocity.y) > vh * 0.3) onClose()
  }

  // A drag that ends over a photo zone must not also flip the photo.
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged.current) return
    dragged.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={person.name}
      data-immersive
      className="fixed inset-0 z-50 flex justify-center"
    >
      <Immersive />
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/70"
        style={reduce ? undefined : { opacity: backdrop }}
        initial={reduce ? { opacity: 0 } : false}
        animate={reduce ? { opacity: 1 } : undefined}
        exit={reduce ? { opacity: 0 } : undefined}
        onClick={onClose}
      />
      <motion.div
        className="bg-background relative flex w-full max-w-md flex-col gap-4 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ y }}
        // No `initial` when moving: y starts off-screen, so `animate` rises from there.
        initial={reduce ? { opacity: 0 } : undefined}
        animate={
          reduce ? { opacity: 1, transition: { duration: 0.2 } } : { y: 0, transition: SHEET }
        }
        exit={
          reduce ? { opacity: 0, transition: { duration: 0.15 } } : { y: vh, transition: SHEET }
        }
        drag={reduce ? false : 'y'}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        onDragStart={() => {
          dragged.current = true
        }}
        onDragEnd={onDragEnd}
      >
        <div className="flex touch-none items-center justify-between" onPointerDown={startDrag}>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.common.back}
            className="active:bg-fill -ml-2 flex size-11 items-center justify-center rounded-full transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.94]"
          >
            <ChevronDown className="size-6" />
          </button>
          <span aria-hidden className="bg-fill h-1.5 w-10 rounded-full" />
          <span aria-hidden className="size-11" />
        </div>
        <article
          className="bg-surface relative min-h-0 flex-1 touch-none overflow-hidden rounded-[1.75rem] shadow-[0_2px_6px_rgb(0_0_0/0.35),0_28px_56px_-28px_rgb(255_77_125/0.3)]"
          onPointerDownCapture={() => {
            dragged.current = false
          }}
          onPointerDown={startDrag}
          onClickCapture={onClickCapture}
        >
          <PhotoCarousel photos={person.photos} alt={person.name} priority />
          <SwipeCardInfo candidate={person} />
        </article>
        <div className="flex items-center justify-center gap-8">
          <Button
            variant="secondary"
            size="icon"
            className="size-16 rounded-full shadow-lg shadow-black/30 active:scale-[0.92]"
            aria-label={dict.likes.pass}
            disabled={busy}
            onClick={() => onDecide('pass')}
          >
            <X className="text-danger size-8" strokeWidth={2.5} />
          </Button>
          <Button
            size="icon"
            className="size-16 rounded-full shadow-lg shadow-black/30 active:scale-[0.92]"
            aria-label={dict.likes.likeBack}
            disabled={busy}
            onClick={() => onDecide('like')}
          >
            <Heart className="size-8 fill-current" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
