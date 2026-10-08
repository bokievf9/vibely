'use client'

import { useLayoutEffect, useRef } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import type { Track } from 'livekit-client'
import { TrackVideo } from './call-media'

type Corner = { right: boolean; bottom: boolean }

// Apple's momentum projection (Designing Fluid Interfaces): where a flick would come to rest.
const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate)

// Own camera in a corner. Drag it anywhere; on release it is thrown towards the corner the flick
// points at and settles there with a spring that keeps the finger's velocity. The bounds stay
// below the header (recording badge) and above the controls, so it never covers either.
export function SelfView({ track, mirror }: { track: Track; mirror: boolean }) {
  const bounds = useRef<HTMLDivElement>(null)
  const pip = useRef<HTMLDivElement>(null)
  const corner = useRef<Corner>({ right: true, bottom: false })
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const target = (c: Corner) => {
    const area = bounds.current?.getBoundingClientRect()
    const box = pip.current?.getBoundingClientRect()
    if (!area || !box) return { x: 0, y: 0 }
    return {
      x: c.right ? area.width - box.width : 0,
      y: c.bottom ? area.height - box.height : 0,
    }
  }

  // Start in the top-right corner and stay in the chosen corner when the screen rotates.
  useLayoutEffect(() => {
    const place = () => {
      const t = target(corner.current)
      x.set(t.x)
      y.set(t.y)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- motion values are stable
  }, [])

  const settle = (_: unknown, info: PanInfo) => {
    const area = bounds.current?.getBoundingClientRect()
    const box = pip.current?.getBoundingClientRect()
    if (!area || !box) return
    const endX = x.get() + project(info.velocity.x) + box.width / 2
    const endY = y.get() + project(info.velocity.y) + box.height / 2
    corner.current = { right: endX > area.width / 2, bottom: endY > area.height / 2 }
    const t = target(corner.current)
    const spring = { type: 'spring', duration: 0.45, bounce: 0.2 } as const
    animate(x, t.x, { ...spring, velocity: info.velocity.x })
    animate(y, t.y, { ...spring, velocity: info.velocity.y })
  }

  return (
    <div
      ref={bounds}
      className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+3.75rem)] bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] z-10"
    >
      <motion.div
        ref={pip}
        drag
        dragMomentum={false}
        dragConstraints={bounds}
        dragElastic={0.15}
        onDragEnd={settle}
        style={{ x, y }}
        className="pointer-events-auto absolute top-0 left-0 aspect-[3/4] w-28 cursor-grab touch-none overflow-hidden rounded-2xl shadow-[0_12px_32px_rgb(0_0_0/0.5)] ring-1 ring-neutral-50/15 active:cursor-grabbing"
      >
        <TrackVideo track={track} mirror={mirror} className="size-full" />
      </motion.div>
    </div>
  )
}
