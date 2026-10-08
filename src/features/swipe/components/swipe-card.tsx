'use client'

import {
  useEffect,
  useImperativeHandle,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from 'react'
import {
  animate,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { haptic } from '@/lib/haptics'
import { PhotoCarousel } from '@/features/profile/components/photo-carousel'
import type { Candidate } from '../schemas'
import { SwipeCardInfo } from './swipe-card-info'
import {
  commitThreshold,
  decideRelease,
  exitTarget,
  MIN_EXIT_VELOCITY,
  project,
  releaseVelocity,
  type Direction,
  type Sample,
} from './swipe-physics'

// The back card waits slightly smaller and dimmed, and grows into place as the top card leaves.
const BACK_SCALE = 0.95
const BACK_DIM = 0.35
// Movement before a press becomes a drag (taps on the photo zones must still work).
const DRAG_SLOP = 8
// Degrees of tilt per pixel of travel; grabbing the bottom half tilts the other way, like paper.
const TILT_PER_PX = 0.06

// Momentum interactions earn a little bounce (apple-design §4); settling and exits don't.
const SPRING_BACK = { type: 'spring', bounce: 0.25, duration: 0.5 } as const
const EXIT = { type: 'spring', bounce: 0, duration: 0.55 } as const
const SETTLE = { type: 'spring', bounce: 0, duration: 0.35 } as const

export type SwipeCardHandle = { fling: (direction: Direction) => void }

type Props = {
  candidate: Candidate
  active: boolean
  onSwipe: (direction: Direction) => void
  // false: a static preview ("How others see me").
  draggable?: boolean
  // Shared 0..1 drag progress of the top card; the back card scales and un-dims with it.
  progress?: MotionValue<number>
  ref?: Ref<SwipeCardHandle>
}

type Drag = {
  id: number
  downX: number
  downY: number
  originX: number
  originY: number
  samples: Sample[]
  dragging: boolean
}

export function SwipeCard({ candidate, active, onSwipe, draggable = true, progress, ref }: Props) {
  const { dict } = useI18n()
  const t = dict.discoverui
  const reduceMotion = useReducedMotion()
  const [isPresent, safeToRemove] = usePresence()
  const el = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const dragged = useRef(false)
  const committed = useRef<{ direction: Direction; vx: number; vy: number } | null>(null)
  const exitStarted = useRef(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const grab = useMotionValue(1)
  const opacity = useMotionValue(0)
  const scale = useMotionValue(active ? 1 : BACK_SCALE)
  const dim = useMotionValue(active ? 0 : BACK_DIM)
  // Rotation is derived from x, so a card that keeps flying keeps turning: no separate exit tilt.
  const rotate = useTransform(() => x.get() * TILT_PER_PX * grab.get())
  const likeOpacity = useTransform(x, [16, 96], [0, 1])
  const nopeOpacity = useTransform(x, [-96, -16], [1, 0])

  const setWillChange = (on: boolean) => {
    if (el.current) el.current.style.willChange = on ? 'transform' : ''
  }

  // Fade in once on mount (first deck load). Exits never fade: the card leaves the screen instead.
  useEffect(() => {
    const a = animate(opacity, 1, { duration: 0.2, ease: [0.23, 1, 0.32, 1] })
    return () => a.stop()
  }, [opacity])

  // Back card: follow the top card's drag. Top card: settle to full size from wherever it was.
  useEffect(() => {
    if (active) {
      const a = animate(scale, 1, SETTLE)
      const b = animate(dim, 0, SETTLE)
      return () => {
        a.stop()
        b.stop()
      }
    }
    if (!progress) return
    return progress.on('change', (p) => {
      scale.set(BACK_SCALE + (1 - BACK_SCALE) * p)
      dim.set(BACK_DIM * (1 - p))
    })
  }, [active, progress, scale, dim])

  // Top card publishes its drag progress until it is committed and leaving.
  useEffect(() => {
    if (!active || !progress || !isPresent) return
    const threshold = commitThreshold(el.current?.offsetWidth ?? 320)
    return x.on('change', (v) => progress.set(Math.min(1, Math.abs(v) / threshold)))
  }, [active, progress, isPresent, x])

  // Removed from the deck: fly out along the committed direction, carrying the release velocity.
  useEffect(() => {
    if (isPresent || exitStarted.current) return
    exitStarted.current = true
    const c = committed.current
    if (!c || reduceMotion) {
      // Not swiped (filters changed) or reduced motion: a short fade in place, no travel.
      void animate(opacity, 0, { duration: 0.18 }).then(() => safeToRemove?.())
      return
    }
    const width = el.current?.offsetWidth ?? 320
    const target = exitTarget(c.direction, window.innerWidth, width)
    const sign = Math.sign(target)
    setWillChange(true)
    animate(y, y.get() + project(c.vy) * 0.5, { ...EXIT, velocity: c.vy })
    void animate(x, target, {
      ...EXIT,
      velocity: sign * Math.max(sign * c.vx, MIN_EXIT_VELOCITY),
    }).then(() => safeToRemove?.())
  }, [isPresent, reduceMotion, safeToRemove, opacity, x, y])

  const commit = (direction: Direction, vx: number, vy: number) => {
    if (committed.current) return
    committed.current = { direction, vx, vy }
    haptic('medium')
    onSwipe(direction)
  }

  // Buttons throw the card the same way a flick does, tilted, slightly upward.
  useImperativeHandle(
    ref,
    () => ({
      fling: (direction) => {
        if (!active || !isPresent) return
        grab.set(1)
        const sign = direction === 'like' ? 1 : -1
        commit(direction, sign * MIN_EXIT_VELOCITY * 1.4, -160)
      },
    }),
    // commit reads refs and the latest onSwipe; re-create the handle when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, isPresent, onSwipe],
  )

  const canDrag = active && draggable && isPresent

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    // One finger only: a second touch mid-drag is ignored instead of making the card jump.
    if (!canDrag || drag.current || committed.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target instanceof Element && e.target.closest('[data-no-drag]')) return
    // Grabbing a card that is still springing home continues from where it is on screen.
    x.stop()
    y.stop()
    const rect = e.currentTarget.getBoundingClientRect()
    grab.set(e.clientY - rect.top < rect.height / 2 ? 1 : -1)
    drag.current = {
      id: e.pointerId,
      downX: e.clientX,
      downY: e.clientY,
      originX: e.clientX - x.get(),
      originY: e.clientY - y.get(),
      samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
      dragging: false,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.downX, e.clientY - d.downY) < DRAG_SLOP) return
      // Capture only once it is a drag, so plain taps still reach the photo zones.
      d.dragging = true
      dragged.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setWillChange(true)
    }
    x.set(e.clientX - d.originX)
    y.set(e.clientY - d.originY)
    d.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    if (d.samples.length > 8) d.samples.shift()
  }

  const release = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    if (!d.dragging) return
    d.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    const { vx, vy } = releaseVelocity(d.samples)
    const direction = cancelled ? null : decideRelease(x.get(), vx, e.currentTarget.offsetWidth)
    if (direction) return commit(direction, vx, vy)
    animate(y, 0, { ...SPRING_BACK, velocity: vy })
    void animate(x, 0, { ...SPRING_BACK, velocity: vx }).then(() => {
      if (!drag.current) setWillChange(false)
    })
  }

  // A drag that ends over a photo zone must not also flip the photo.
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged.current) return
    dragged.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    <motion.article
      ref={el}
      className="bg-surface absolute inset-0 overflow-hidden rounded-3xl shadow-xl shadow-black/40 select-none data-[drag=true]:touch-none"
      data-drag={canDrag}
      style={{ x, y, rotate, scale, opacity, zIndex: isPresent ? (active ? 2 : 1) : 3 }}
      // Every new press starts clean, even one that never becomes a drag (e.g. on "More").
      onPointerDownCapture={() => {
        dragged.current = false
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => release(e, false)}
      onPointerCancel={(e) => release(e, true)}
      onClickCapture={onClickCapture}
      aria-hidden={!active}
      inert={!active || !isPresent}
    >
      <PhotoCarousel photos={candidate.photos} alt={candidate.name} priority={active} />
      {candidate.secondChance && (
        <span className="pointer-events-none absolute top-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold whitespace-nowrap text-white backdrop-blur-sm">
          <RotateCcw className="size-3.5" aria-hidden /> {dict.discover.secondChance}
        </span>
      )}
      <motion.span
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="border-accent text-accent pointer-events-none absolute top-10 left-6 -rotate-12 rounded-2xl border-4 bg-black/20 px-3 py-1 text-3xl font-black tracking-wide whitespace-nowrap"
      >
        {t.stampLike}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: nopeOpacity }}
        className="border-danger text-danger pointer-events-none absolute top-10 right-6 rotate-12 rounded-2xl border-4 bg-black/20 px-3 py-1 text-3xl font-black tracking-wide whitespace-nowrap"
      >
        {t.stampNope}
      </motion.span>
      <SwipeCardInfo candidate={candidate} />
      {/* Dim layer for the waiting back card; fades out as the top card is dragged away. */}
      <motion.div
        aria-hidden
        style={{ opacity: dim }}
        className="pointer-events-none absolute inset-0 bg-black"
      />
    </motion.article>
  )
}
