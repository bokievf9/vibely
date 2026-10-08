'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import { X } from 'lucide-react'
import { useOptionalI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Sticky actions pinned under the scrolling body (stays visible while the body scrolls). */
  footer?: ReactNode
  /** 'auto' hugs the content (default); 'tall' always takes the full 90dvh, for long lists. */
  size?: 'auto' | 'tall'
}

// Bottom sheet on phones, centered dialog on wider screens. Rendered into <body> so a parent
// with backdrop-filter or transform (sticky headers) cannot clip or re-anchor it.
export function Modal(props: ModalProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>{props.open && <Sheet {...props} />}</AnimatePresence>,
    document.body,
  )
}

const noopSubscribe = () => () => {}

// Open sheets, topmost last: only the top one reacts to Escape and traps Tab.
const stack: string[] = []
let scrollLocks = 0
let savedOverflow = ''
let savedPaddingRight = ''

function lockScroll() {
  if (scrollLocks++ > 0) return
  const body = document.body
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  savedOverflow = body.style.overflow
  savedPaddingRight = body.style.paddingRight
  body.style.overflow = 'hidden'
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
}

function unlockScroll() {
  if (--scrollLocks > 0) return
  document.body.style.overflow = savedOverflow
  document.body.style.paddingRight = savedPaddingRight
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Drag physics (.claude/skills/apple-design §5, §6, §9).
const OPEN = { type: 'tween', duration: 0.42, ease: [0.32, 0.72, 0, 1] } as const
const SETTLE = { type: 'spring', bounce: 0.15, duration: 0.45 } as const
const DISMISS = { type: 'spring', bounce: 0, duration: 0.32 } as const
const project = (velocity: number) => ((velocity / 1000) * 0.998) / (1 - 0.998)
const rubberband = (over: number, size: number) => (over * size * 0.55) / (size + 0.55 * over)

type Sample = { y: number; t: number }

function Sheet({ onClose, title, children, footer, size = 'auto' }: ModalProps) {
  const closeLabel = useOptionalI18n()?.dict.common.close ?? 'Закрыть'
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [isPresent, safeToRemove] = usePresence()
  const reduce = useReducedMotion() ?? false

  const y = useMotionValue(0)
  const fade = useMotionValue(reduce ? 0 : 1)
  const height = useRef(800)
  const backdrop = useTransform<number, number>([y, fade], ([dy = 0, f = 1]) => {
    const progress = Math.max(0, dy) / height.current
    return Math.min(f, 1 - Math.min(progress, 1))
  })

  // Latest onClose without re-running effects when the parent passes a new arrow each render.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  // Enter: off-screen to rest. Reduced motion: a short fade, no movement.
  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el) return
    height.current = el.offsetHeight || height.current
    if (reduce) {
      const controls = animate(fade, 1, { duration: 0.18, ease: 'easeOut' })
      return () => controls.stop()
    }
    y.set(height.current)
    const controls = animate(y, 0, OPEN)
    return () => controls.stop()
  }, [reduce, y, fade])

  // Exit: continues from wherever the sheet is (mid-drag included) with its current velocity.
  useEffect(() => {
    if (isPresent) return
    const controls = reduce
      ? animate(fade, 0, { duration: 0.16, ease: 'easeOut' })
      : animate(y, height.current, { ...DISMISS, velocity: y.getVelocity() })
    controls.then(() => safeToRemove?.())
    return () => controls.stop()
  }, [isPresent, reduce, y, fade, safeToRemove])

  // Stack, scroll lock, Escape, focus trap and focus return.
  const id = useId()
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    stack.push(id)
    lockScroll()
    sheetRef.current?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !sheetRef.current) return
      const items = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        e.preventDefault()
        return
      }
      const current = document.activeElement
      if (e.shiftKey && (current === first || current === sheetRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      } else if (!sheetRef.current.contains(current)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      unlockScroll()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [id])

  // ---- Drag to dismiss -------------------------------------------------------------------------
  const isPresentRef = useRef(isPresent)
  useLayoutEffect(() => {
    isPresentRef.current = isPresent
  })

  const drag = useRef<{ startY: number; origin: number; samples: Sample[] } | null>(null)

  const begin = useCallback(
    (clientY: number) => {
      height.current = sheetRef.current?.offsetHeight || height.current
      y.stop()
      drag.current = {
        startY: clientY,
        origin: y.get(),
        samples: [{ y: clientY, t: performance.now() }],
      }
    },
    [y],
  )

  const move = useCallback(
    (clientY: number) => {
      const d = drag.current
      if (!d) return
      const raw = d.origin + clientY - d.startY
      // Down follows the finger 1:1; up resists more the further it goes.
      y.set(raw >= 0 ? raw : -rubberband(-raw, height.current))
      d.samples.push({ y: clientY, t: performance.now() })
      if (d.samples.length > 5) d.samples.shift()
    },
    [y],
  )

  const end = useCallback(() => {
    const d = drag.current
    if (!d) return
    drag.current = null
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const dt = first && last ? last.t - first.t : 0
    // px/s over the last few moves; a finger that stopped before lifting has no velocity.
    const velocity =
      first && last && dt > 0 && performance.now() - last.t < 80
        ? ((last.y - first.y) / dt) * 1000
        : 0
    const projected = y.get() + project(velocity)
    // A flick (projected past half the sheet) or a long drag dismisses; an upward fling never does.
    if (velocity >= 0 && (projected > height.current / 2 || y.get() > height.current * 0.35)) {
      void animate(y, height.current, { ...DISMISS, velocity }).then(() => {
        // The parent may refuse to close (e.g. a pending action): come back up.
        if (sheetRef.current?.isConnected && isPresentRef.current) animate(y, 0, SETTLE)
      })
      onCloseRef.current()
    } else {
      animate(y, 0, { ...SETTLE, velocity })
    }
  }, [y])

  // Handle (grabber + title row): pointer events, owns every axis.
  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    begin(e.clientY)
  }

  // Body: a downward pull while the content is scrolled to the top drags the sheet instead of
  // scrolling. Native touch listeners because only they can cancel the scroll (non-passive).
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    let start: { x: number; y: number } | null = null
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null
        return
      }
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable], [data-sheet-no-drag]')) {
        start = null
        return
      }
      const touch = e.touches[0]
      start = touch ? { x: touch.clientX, y: touch.clientY } : null
    }
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      if (drag.current) {
        e.preventDefault()
        move(touch.clientY)
        return
      }
      if (!start || e.touches.length !== 1) return
      const dy = touch.clientY - start.y
      const dx = touch.clientX - start.x
      if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return // hysteresis
      if (dy > 0 && Math.abs(dy) > Math.abs(dx) && body.scrollTop <= 0) {
        e.preventDefault()
        begin(start.y)
        move(touch.clientY)
      }
      start = null
    }
    const onEnd = () => {
      start = null
      end()
    }
    body.addEventListener('touchstart', onStart, { passive: true })
    body.addEventListener('touchmove', onMove, { passive: false })
    body.addEventListener('touchend', onEnd)
    body.addEventListener('touchcancel', onEnd)
    return () => {
      body.removeEventListener('touchstart', onStart)
      body.removeEventListener('touchmove', onMove)
      body.removeEventListener('touchend', onEnd)
      body.removeEventListener('touchcancel', onEnd)
    }
  }, [begin, move, end])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/60"
        style={{ opacity: backdrop }}
        onClick={() => onCloseRef.current()}
      />
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ y, opacity: fade }}
        className={cn(
          'bg-surface relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl outline-none sm:rounded-3xl',
          'shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/[0.06]',
          // Pulled up past rest, the sheet stretches instead of lifting off the screen edge.
          'max-sm:after:bg-surface max-sm:after:pointer-events-none max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:top-full max-sm:after:h-40',
          size === 'tall' && 'h-[90dvh]',
        )}
      >
        <div
          className="shrink-0 cursor-grab touch-none px-5 pt-2 select-none active:cursor-grabbing"
          onPointerDown={onHandleDown}
          onPointerMove={(e) => move(e.clientY)}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div aria-hidden className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              aria-label={closeLabel}
              className="text-muted active:bg-border -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,scale] duration-150 ease-out active:scale-[0.92]"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>
        <div
          ref={bodyRef}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2',
            footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="border-border/60 shrink-0 border-t px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}
