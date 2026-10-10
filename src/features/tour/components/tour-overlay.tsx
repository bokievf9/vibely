'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BadgeCheck,
  CalendarHeart,
  Crown,
  Footprints,
  Heart,
  MessageCircle,
  Newspaper,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { useAccess } from '@/features/plans/components/access-provider'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { cardWidth, place, unionRect, type Rect } from '../placement'
import {
  appPath,
  OPTIONAL_TIMEOUT_MS,
  stepAfter,
  targetTimeout,
  TOUR_STEPS,
  visibleSteps,
  type TipKey,
  type TourStepId,
} from '../steps'
import { findTargets, rectOf, safeInsets, tabBarTop, trapTab } from './dom'

// Motion (.claude/skills/emil-design-eng, animate). Rare, first-run UI: the delight budget lives
// here. The spotlight and the card travel between targets on one spring so they read as a single
// object; content swaps with a short blurred crossfade. Reduced motion: fades only, the spotlight
// and the card jump.
const SPRING = { type: 'spring', duration: 0.55, bounce: 0.14 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const INSTANT = { duration: 0 } as const
// How long a route change may take before its step is given up.
const NAV_TIMEOUT_MS = 8000
// A screen still showing skeletons gets this long to load before its step shows anyway.
const LOADING_GRACE_MS = 3000
// Before the first measurement: a typical card, so the first frame is already close.
const CARD_ESTIMATE = 188

const ICONS: Record<TourStepId, LucideIcon> = {
  deck: Heart,
  filters: SlidersHorizontal,
  statuses: Sparkles,
  event: CalendarHeart,
  crossed: Footprints,
  mode: Users,
  people: Search,
  blind: VenetianMask,
  feed: Newspaper,
  chats: MessageCircle,
  profile: BadgeCheck,
  settings: ShieldCheck,
  plans: Crown,
}

type Props = {
  // Open on the welcome card (first run) or straight on the first step (replay).
  welcome: boolean
  name: string
  onEnd: (kind: 'complete' | 'skip', step: number) => void
  onTip: (key: TipKey) => void
}

// The guided tour over the real app: a dimmed screen with a rounded cut-out around the current
// target (an SVG mask), and a card above or below it. Steps live on different tabs: the tour
// navigates there, waits for the target to mount and skips a step whose feature is not there.
// z-[55]: above sheets (z-50), below toasts and calls (z-60).
export function TourOverlay({ welcome, name, onEnd, onTip }: Props) {
  const { dict } = useI18n()
  const t = dict.tour
  // Free users can read, like and reply privately in the feed, but posting needs Plus.
  const canPost = useAccess().has('feed_post')
  // useLocaleRouter() is a new object on every render: read it through a ref so the step effect
  // below runs once per step, not once per render.
  const router = useLocaleRouter()
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  })
  const reduce = useReducedMotion() ?? false
  const maskId = useId()
  const titleId = useId()
  const textId = useId()

  const [mode, setMode] = useState<'welcome' | 'steps'>(welcome ? 'welcome' : 'steps')
  const [index, setIndex] = useState(0)
  const dir = useRef<1 | -1>(1)
  const [missing, setMissing] = useState<ReadonlySet<TourStepId>>(() => new Set())
  // The step on screen and the data-tour key it resolved to (its target or the fallback).
  const [shown, setShown] = useState<{ index: number; key: string } | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: 390, height: 844 })
  const [insets, setInsets] = useState({ top: 8, bottom: 8 })
  // Top edge of the tab bar: the card stays above it unless the tab bar is what lights up.
  const [tabTop, setTabTop] = useState<number | null>(null)
  const [cardHeight, setCardHeight] = useState(CARD_ESTIMATE)
  const cardRef = useRef<HTMLDivElement>(null)
  const welcomeRef = useRef<HTMLDivElement>(null)
  const routeSince = useRef(0)
  const lastPath = useRef<string | null>(null)

  const ready = mode === 'steps' && shown?.index === index && rect !== null
  const step = TOUR_STEPS[shown?.index ?? index]!
  const visible = visibleSteps(TOUR_STEPS, missing)
  const position = Math.max(
    0,
    visible.findIndex((s) => s.id === step.id),
  )
  const isLast = stepAfter(TOUR_STEPS, index, 1, missing) >= TOUR_STEPS.length

  // Viewport and safe area (fixed overlay coordinates).
  useLayoutEffect(() => {
    const read = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      const safe = safeInsets()
      setInsets({ top: safe.top + 8, bottom: safe.bottom + 8 })
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  // ---- Step resolution: route, then target, then fallback, else skip -------------------------
  const finish = useCallback(
    (kind: 'complete' | 'skip', at: number) => {
      onEnd(kind, at)
      if (kind === 'complete') routerRef.current.push('/swipe')
    },
    [onEnd],
  )

  useEffect(() => {
    if (mode !== 'steps') return
    const current = TOUR_STEPS[index]
    if (!current) return
    const startedAt = performance.now()
    let pushed = false
    let matchedAt: number | null = null
    let budget = 0
    let done = false

    const show = (key: string) => {
      done = true
      const union = unionRect(findTargets(key).map(rectOf))
      // Off screen (a section further down Settings): scroll it in first. A tall target goes
      // just under the sticky header, a small one to the middle of the screen.
      const header = document.querySelector('[data-main] header')?.getBoundingClientRect().bottom
      const top = (header ?? 56) + 12
      const bottom = tabBarTop() ?? window.innerHeight
      if (union && (union.y < top || union.y + union.height > bottom - 12)) {
        const tall = union.height > (bottom - top) / 2
        const to = tall ? top : (top + bottom - union.height) / 2
        window.scrollTo({
          top: window.scrollY + union.y - to,
          behavior: reduce ? 'auto' : 'smooth',
        })
      }
      setShown((prev) => (prev?.index === index && prev.key === key ? prev : { index, key }))
    }
    const giveUp = () => {
      done = true
      const next = new Set(missing).add(current.id)
      setMissing(next)
      const to = stepAfter(TOUR_STEPS, index, dir.current, next)
      if (to >= TOUR_STEPS.length) finish('complete', index)
      else setIndex(Math.max(0, to))
    }
    const tick = () => {
      if (done) return
      const now = performance.now()
      if (appPath(window.location.pathname) !== current.route) {
        if (!pushed) {
          pushed = true
          routerRef.current.push(current.route)
        }
        if (now - startedAt > NAV_TIMEOUT_MS) giveUp()
        return
      }
      if (matchedAt === null) {
        matchedAt = now
        budget = targetTimeout(current, now - routeSince.current)
      }
      // Never explain a screen over its loading skeletons.
      const loading = document.querySelector('[data-main] .skeleton-shimmer') !== null
      if (loading && now - matchedAt < LOADING_GRACE_MS) {
        budget += 100
        return
      }
      if (findTargets(current.target).length) return show(current.target)
      if (now - matchedAt < budget) return
      if (current.fallback && findTargets(current.fallback).length) return show(current.fallback)
      giveUp()
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => {
      done = true
      window.clearInterval(timer)
    }
    // `missing` is read when giving up; re-running on its change would restart the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, index, reduce, finish])

  // When the route last changed (optional targets get a short grace period from then).
  useEffect(() => {
    const check = () => {
      const path = window.location.pathname
      if (path !== lastPath.current) {
        lastPath.current = path
        routeSince.current = performance.now()
      }
    }
    check()
    const timer = window.setInterval(check, 100)
    return () => window.clearInterval(timer)
  }, [])

  // ---- Measuring the target while its step is on screen ---------------------------------------
  useEffect(() => {
    if (!shown) return
    let frame = 0
    const measure = () => {
      frame = 0
      setTabTop(tabBarTop())
      const next = unionRect(findTargets(shown.key).map(rectOf))
      if (!next) return
      setRect((prev) =>
        prev &&
        Math.abs(prev.x - next.x) < 0.5 &&
        Math.abs(prev.y - next.y) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    // Late layout (route fade-in, images, async rows) and smooth scrolling move the target.
    const timer = window.setInterval(schedule, 150)
    const observer = new ResizeObserver(schedule)
    for (const el of findTargets(shown.key)) observer.observe(el)
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.clearInterval(timer)
      observer.disconnect()
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [shown])

  // Optional features of this screen that are not here once it has settled are dropped right
  // away, so the dots count what the user will actually see.
  useEffect(() => {
    if (!shown) return
    const here = TOUR_STEPS[shown.index]!.route
    const prune = () => {
      const gone = TOUR_STEPS.filter(
        (s, i) =>
          i > shown.index && s.optional && s.route === here && !findTargets(s.target).length,
      ).map((s) => s.id)
      if (gone.length)
        setMissing((m) => (gone.every((id) => m.has(id)) ? m : new Set([...m, ...gone])))
    }
    const wait = Math.max(0, OPTIONAL_TIMEOUT_MS - (performance.now() - routeSince.current))
    const timer = window.setTimeout(prune, wait)
    return () => window.clearTimeout(timer)
  }, [shown])

  // A step was reached: analytics, and its tip counts as seen.
  useEffect(() => {
    if (!shown) return
    const s = TOUR_STEPS[shown.index]!
    track('tour_step', { n: position + 1, step: s.id })
    if (s.tip) onTip(s.tip)
    // Position is derived from the same render; only a new step should fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  // Card height for the placement math.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (mode !== 'steps' || !el) return
    const read = () => setCardHeight(el.offsetHeight || CARD_ESTIMATE)
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mode])

  // ---- Keyboard: Escape skips, Tab stays in the card, focus follows the step ------------------
  const skip = useCallback(() => {
    finish('skip', mode === 'welcome' ? 0 : position + 1)
  }, [finish, mode, position])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        skip()
        return
      }
      trapTab(e, mode === 'welcome' ? welcomeRef.current : cardRef.current)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [skip, mode])

  useEffect(() => {
    const el = mode === 'welcome' ? welcomeRef.current : ready ? cardRef.current : null
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
  }, [mode, ready, shown])

  // Focus goes back where it was when the tour ends.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true })
    }
  }, [])

  // The page under the overlay must not scroll by touch or wheel (the overlay owns the screen).
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const stop = (e: Event) => {
      const target = e.target as Node
      if (!cardRef.current?.contains(target) && !welcomeRef.current?.contains(target)) {
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('wheel', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [])

  const next = () => {
    if (mode === 'welcome') {
      track('tour_start', { source: 'welcome' })
      setMode('steps')
      return
    }
    if (isLast) return finish('complete', index)
    dir.current = 1
    setIndex(stepAfter(TOUR_STEPS, index, 1, missing))
  }
  const back = () => {
    const to = stepAfter(TOUR_STEPS, index, -1, missing)
    if (to < 0) return
    dir.current = -1
    setIndex(to)
  }

  // ---- Layout -------------------------------------------------------------------------------
  const aboveTabs = rect && tabTop !== null && rect.y + rect.height <= tabTop + 1
  const placement =
    mode === 'steps' && rect
      ? place(rect, viewport, cardHeight, {
          top: insets.top,
          bottom: aboveTabs ? Math.max(insets.bottom, viewport.height - tabTop + 8) : insets.bottom,
        })
      : null
  // Welcome: no cut-out yet, a point in the middle that opens up into the first target.
  const spot = placement?.spot ?? {
    x: viewport.width / 2,
    y: viewport.height / 2,
    width: 0,
    height: 0,
  }
  const radius = Math.min(18, spot.height / 2, spot.width / 2)
  const width = placement?.card.width ?? cardWidth(viewport.width)
  const cardX = placement?.card.x ?? (viewport.width - width) / 2
  const cardY =
    placement?.card.y ?? Math.max(insets.top, viewport.height - insets.bottom - cardHeight - 64)
  const move = reduce ? INSTANT : SPRING
  const base = t.steps[step.id]
  const text =
    step.id === 'feed' && !canPost ? { ...base, text: t.steps.feed.textLocked } : base
  const Icon = ICONS[step.id]
  const live =
    mode === 'welcome'
      ? `${fmt(t.welcome.title, { name })}. ${t.welcome.text}`
      : ready
        ? fmt(t.live, {
            n: position + 1,
            total: visible.length,
            title: text.title,
            text: text.text,
          })
        : ''

  return (
    <motion.div
      ref={rootRef}
      data-tour-overlay
      className="fixed inset-0 z-[55] touch-none select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
    >
      <svg aria-hidden className="absolute inset-0 size-full" width="100%" height="100%">
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <motion.rect
              initial={false}
              animate={{ x: spot.x, y: spot.y, width: spot.width, height: spot.height, rx: radius }}
              transition={move}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(6 4 8 / 0.74)" mask={`url(#${maskId})`} />
        {/* A soft accent ring traces the cut-out. */}
        <motion.rect
          initial={false}
          animate={{
            x: spot.x,
            y: spot.y,
            width: spot.width,
            height: spot.height,
            rx: radius,
            opacity: ready ? 1 : 0,
          }}
          transition={{ ...move, opacity: { duration: 0.2, ease: EASE_OUT } }}
          fill="none"
          stroke="rgb(255 120 160 / 0.55)"
          strokeWidth={1.5}
        />
      </svg>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </p>

      <AnimatePresence>
        {mode === 'welcome' && (
          <WelcomeCard
            key="welcome"
            ref={welcomeRef}
            name={name}
            titleId={titleId}
            textId={textId}
            reduce={reduce}
            insets={insets}
            onStart={next}
            onSkip={skip}
          />
        )}
      </AnimatePresence>
      {mode === 'steps' && (
        <motion.div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.label}
          aria-labelledby={titleId}
          aria-describedby={textId}
          tabIndex={-1}
          className="card-raised absolute top-0 left-0 touch-auto rounded-[1.375rem] px-4 pt-3 pb-3.5 outline-none select-text"
          style={{ width }}
          initial={{ opacity: 0, x: cardX, y: cardY + (reduce ? 0 : 10), scale: reduce ? 1 : 0.97 }}
          animate={{ opacity: ready ? 1 : 0, x: cardX, y: cardY, scale: 1 }}
          transition={{
            x: move,
            y: move,
            scale: move,
            opacity: { duration: ready ? 0.22 : 0.12, ease: EASE_OUT },
          }}
        >
          {placement && placement.arrowX !== null && (
            <motion.span
              aria-hidden
              initial={false}
              animate={{ x: placement.arrowX - 7, rotate: 45 }}
              transition={move}
              className={cn(
                'bg-surface-raised absolute left-0 size-3.5 border-white/[0.08]',
                placement.side === 'below'
                  ? '-top-[7px] border-t border-l'
                  : '-bottom-[7px] border-r border-b',
              )}
            />
          )}
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Dots count={visible.length} current={position} />
            <button
              type="button"
              onClick={skip}
              aria-label={t.skipLabel}
              className="text-muted text-callout active:bg-fill -mr-2 flex h-11 shrink-0 items-center rounded-full px-3 font-medium transition-[background-color,scale] duration-150 ease-out active:scale-[0.96]"
            >
              {t.skip}
            </button>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={step.id}
              initial={{ opacity: 0, filter: reduce ? 'none' : 'blur(3px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: reduce ? 'none' : 'blur(3px)' }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="flex items-start gap-3 pt-0.5"
            >
              <span aria-hidden className="icon-tile bg-accent/15 text-accent mt-0.5">
                <Icon className="size-[1.0625rem]" strokeWidth={2.2} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 id={titleId} className="text-headline text-pretty">
                  {text.title}
                </h2>
                <p id={textId} className="text-muted text-callout text-pretty">
                  {text.text}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="mt-3.5 flex items-center justify-end gap-2">
            {position > 0 && (
              <Button variant="ghost" size="sm" onClick={back} className="mr-auto -ml-2 px-3">
                {t.back}
              </Button>
            )}
            <Button size="sm" onClick={next} className="min-w-24 px-5">
              {isLast ? t.done : t.next}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// Where the user is in the tour. The current dot stretches into a short pill.
function Dots({ count, current }: { count: number; current: number }) {
  return (
    <span aria-hidden className="flex min-w-0 items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out',
            i === current
              ? 'bg-accent w-4'
              : i < current
                ? 'w-1.5 bg-white/45'
                : 'w-1.5 bg-white/15',
          )}
        />
      ))}
    </span>
  )
}

type WelcomeProps = {
  ref: Ref<HTMLDivElement>
  name: string
  titleId: string
  textId: string
  reduce: boolean
  insets: { top: number; bottom: number }
  onStart: () => void
  onSkip: () => void
}

// The first moment after sign-up: three marks of the app gather around a heart, then a warm
// line and two choices. A modal, so it stays centered (no trigger to scale from).
function WelcomeCard({
  ref,
  name,
  titleId,
  textId,
  reduce,
  insets,
  onStart,
  onSkip,
}: WelcomeProps) {
  const { dict } = useI18n()
  const t = dict.tour.welcome
  // Staggered entrance (60ms apart), from below; reduced motion keeps only the fade.
  const rise = (i: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.42, ease: EASE_OUT, delay: 0.12 + i * 0.06 },
    },
  })
  const orbit = (x: number, i: number) => ({
    initial: { opacity: 0, x: reduce ? x : x * 0.4, scale: reduce ? 1 : 0.85 },
    animate: {
      opacity: 1,
      x,
      scale: 1,
      transition: reduce
        ? { duration: 0.2 }
        : { type: 'spring' as const, duration: 0.7, bounce: 0.3, delay: 0.18 + i * 0.07 },
    },
  })
  return (
    <motion.div
      className="absolute inset-x-0 flex justify-center px-4"
      style={{ top: insets.top, bottom: insets.bottom + 8 }}
      exit={{
        opacity: 0,
        scale: reduce ? 1 : 0.98,
        transition: { duration: 0.16, ease: EASE_OUT },
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        className="card-raised relative my-auto flex w-full max-w-[360px] touch-auto flex-col items-center overflow-hidden px-5 pt-7 pb-5 text-center outline-none select-text"
        initial={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-20 h-56 bg-[radial-gradient(55%_60%_at_50%_45%,rgb(255_77_125/0.24),transparent)]"
        />
        <div aria-hidden className="relative mb-5 flex h-20 w-48 items-center justify-center">
          <motion.span
            {...orbit(-58, 0)}
            className="card absolute flex size-12 items-center justify-center rounded-2xl"
          >
            <VenetianMask className="text-accent size-5" strokeWidth={2} />
          </motion.span>
          <motion.span
            {...orbit(58, 1)}
            className="card absolute flex size-12 items-center justify-center rounded-2xl"
          >
            <MessageCircle className="text-accent size-5" strokeWidth={2} />
          </motion.span>
          <motion.span
            {...orbit(0, 2)}
            className="btn-accent relative flex size-16 items-center justify-center rounded-[1.375rem]"
          >
            <Heart className="size-7 fill-current" />
          </motion.span>
        </div>
        <motion.h2 {...rise(0)} id={titleId} className="text-title2 relative text-balance">
          {fmt(t.title, { name })}
        </motion.h2>
        <motion.p
          {...rise(1)}
          id={textId}
          className="text-muted text-callout relative mt-2 text-pretty"
        >
          {t.text}
        </motion.p>
        <motion.div {...rise(2)} className="relative mt-6 flex w-full flex-col gap-1.5">
          <Button fullWidth onClick={onStart}>
            {t.start}
          </Button>
          <Button variant="ghost" fullWidth onClick={onSkip} className="text-muted">
            {t.skip}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
