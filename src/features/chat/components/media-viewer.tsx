'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'framer-motion'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import type { ChatImage, ChatVideo } from '../types'

export type ViewerMedia = ChatImage | ChatVideo

// What is open, and where it came from on screen (for the shared-element transition).
export type ViewerState = { media: ViewerMedia; origin: DOMRect | null; messageId: string }

type Props = { viewer: ViewerState | null; onClose: () => void }

// Full-screen photo or video circle (with sound). It grows out of the bubble and shrinks back into
// it; tap the backdrop, the × or press Escape to close, or drag it away (a flick is enough).
export function MediaViewer({ viewer, onClose }: Props) {
  return (
    <AnimatePresence>
      {viewer?.media.url && <Viewer key={viewer.messageId} viewer={viewer} onClose={onClose} />}
    </AnimatePresence>
  )
}

type Box = { left: number; top: number; width: number; height: number }

const VIDEO_MAX_PX = 448
const DISMISS_PX = 120
const DISMISS_VELOCITY = 600 // px/s
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

// Where the media sits when open: as large as fits, centered.
function fit(media: ViewerMedia): Box {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (media.kind === 'video') {
    const size = Math.min(vw * 0.9, VIDEO_MAX_PX)
    return { left: (vw - size) / 2, top: (vh - size) / 2, width: size, height: size }
  }
  const scale = Math.min(vw / media.width, vh / media.height)
  const width = media.width * scale
  const height = media.height * scale
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height }
}

// FLIP: the transform that puts the open box exactly over the bubble's media.
function fromRect(rect: DOMRect, box: Box) {
  const sx = rect.width / box.width
  const sy = rect.height / box.height
  return `translate(${rect.left - box.left}px, ${rect.top - box.top}px) scale(${sx}, ${sy})`
}

const sourceRect = (messageId: string) =>
  document.querySelector(`#msg-${CSS.escape(messageId)} [data-media]`)?.getBoundingClientRect() ??
  null

function Viewer({ viewer, onClose }: { viewer: ViewerState; onClose: () => void }) {
  const { media } = viewer
  const { dict } = useI18n()
  const reduce = useReducedMotion()
  const [box, setBox] = useState(() => fit(media))
  const y = useMotionValue(0)
  // The backdrop fades with the drag: the chat shows through as the photo is pulled away.
  const backdrop = useTransform(y, [-320, 0, 320], [0, 1, 0])
  const flung = useRef(0)
  const dragged = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onResize = () => setBox(fit(media))
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    // Scroll lock: the chat behind must not move while the viewer is open.
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      html.style.overflow = overflow
    }
  }, [media, onClose])

  const label = media.kind === 'video' ? dict.media.video : dict.chats.photo
  const open = 'translate(0px, 0px) scale(1, 1)'
  const radius = media.kind === 'video' ? '50%' : '0px'
  const variants: Variants = {
    hidden: () =>
      reduce || !viewer.origin
        ? { opacity: 0, transform: reduce ? open : 'translate(0px, 0px) scale(0.92, 0.92)' }
        : { opacity: 1, transform: fromRect(viewer.origin, box), borderRadius: '12px' },
    shown: {
      opacity: 1,
      transform: open,
      borderRadius: radius,
      transition: { duration: 0.32, ease: EASE_DRAWER },
    },
    // Resolved when the exit starts: back into the bubble if it is still on screen, otherwise
    // on along the flick.
    exit: () => {
      const rect = flung.current || reduce ? null : sourceRect(viewer.messageId)
      if (rect) {
        return {
          opacity: 1,
          transform: fromRect(rect, box),
          borderRadius: '12px',
          transition: { duration: 0.26, ease: EASE_DRAWER },
        }
      }
      return {
        opacity: 0,
        transform: flung.current
          ? `translate(0px, ${flung.current * 160}px) scale(1, 1)`
          : 'translate(0px, 0px) scale(0.92, 0.92)',
        transition: { duration: 0.2, ease: EASE_OUT },
      }
    },
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 touch-none overscroll-contain"
      onClick={onClose}
      initial="hidden"
      animate="shown"
      exit="exit"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        variants={{
          hidden: { opacity: 0 },
          shown: { opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } },
          exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } },
        }}
      >
        <motion.div className="size-full bg-neutral-950/95" style={{ opacity: backdrop }} />
      </motion.div>
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={1}
        dragSnapToOrigin
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          if (
            Math.abs(info.offset.y) > DISMISS_PX ||
            Math.abs(info.velocity.y) > DISMISS_VELOCITY
          ) {
            flung.current = Math.sign(info.offset.y || info.velocity.y)
            onClose()
          }
        }}
        className="fixed"
        // The fitted box; the FLIP transforms below are relative to it. left/top/size change only
        // on open and on resize, never during an animation.
        style={{ y, left: box.left, top: box.top, width: box.width, height: box.height }}
      >
        <motion.div
          variants={variants}
          className="size-full overflow-hidden will-change-transform"
          style={{ transformOrigin: '0 0' }}
          onClick={(e) => e.stopPropagation()}
        >
          {media.kind === 'video' ? (
            <video
              src={media.url ?? undefined}
              autoPlay
              playsInline
              disablePictureInPicture
              aria-label={dict.media.watch}
              // Tap to pause/resume (also the fallback when autoplay with sound is blocked).
              onClick={(e) => {
                if (dragged.current) return void (dragged.current = false)
                const v = e.currentTarget
                if (v.paused) void v.play().catch(() => undefined)
                else v.pause()
              }}
              className="size-full bg-neutral-900 object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- private signed URL, never via the optimizer
            <img
              src={media.url ?? undefined}
              alt={label}
              width={media.width}
              height={media.height}
              draggable={false}
              className="size-full object-contain select-none"
            />
          )}
        </motion.div>
      </motion.div>
      <motion.button
        type="button"
        onClick={onClose}
        aria-label={dict.common.close}
        variants={{
          hidden: { opacity: 0 },
          shown: { opacity: 1, transition: { duration: 0.2, delay: 0.1 } },
          exit: { opacity: 0, transition: { duration: 0.1 } },
        }}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 flex size-11 items-center justify-center rounded-full bg-neutral-50/15 text-neutral-50 backdrop-blur transition-transform duration-150 ease-out active:scale-90"
      >
        <X className="size-6" />
      </motion.button>
    </motion.div>
  )
}
