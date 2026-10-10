'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  CalendarHeart,
  Eye,
  Footprints,
  Heart,
  HeartHandshake,
  Lightbulb,
  Sparkles,
  Users,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/i18n/client'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { nextTip, TIP_KEYS, type TipKey } from '../steps'
import { modalOpen, tipPresent } from './dom'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
// A feature has to be on screen this long before its tip shows: never on top of a fast tap-through.
const SETTLE_MS = 1200

const ICONS = {
  duo: Users,
  statuses: Sparkles,
  crossed_paths: Footprints,
  event: CalendarHeart,
  visitors: Eye,
  crush: Heart,
  matchmaker: HeartHandshake,
} as const satisfies Record<TipKey, unknown>

// One-time hints for secondary features: the first time a feature's [data-tip] marker is on
// screen, a small card explains it. One at a time, never over a sheet or the tour, never again
// once shown (stored on the server and on the device). It floats above the tab bar, or under the
// header on immersive screens (a chat room has no tab bar but a composer at the bottom).
export function TipHost({
  seen,
  onSeen,
}: {
  seen: ReadonlySet<string>
  onSeen: (key: TipKey) => void
}) {
  const { dict } = useI18n()
  const t = dict.tour.tip
  const reduce = useReducedMotion() ?? false
  const pathname = usePathname()
  // The tip on screen and the screen it belongs to: a new screen closes it.
  const [shown, setShown] = useState<{ key: TipKey; path: string; immersive: boolean } | null>(null)
  const tip = shown && shown.path === pathname ? shown.key : null
  const immersive = shown?.immersive ?? false
  const seenRef = useRef(seen)
  useEffect(() => {
    seenRef.current = seen
  })

  // While a tip is up, the install banner (same spot) steps aside (globals.css).
  useEffect(() => {
    if (!tip) return
    document.body.dataset.tipOpen = ''
    return () => {
      delete document.body.dataset.tipOpen
    }
  }, [tip])

  // Watches the page for markers while some tip is still unseen.
  useEffect(() => {
    if (tip || TIP_KEYS.every((k) => seen.has(k))) return
    let candidate: TipKey | null = null
    let since = 0
    const check = () => {
      if (document.body.dataset.tour !== undefined || modalOpen()) {
        candidate = null
        return
      }
      const key = nextTip(tipPresent, seenRef.current)
      if (key !== candidate) {
        candidate = key
        since = performance.now()
        return
      }
      if (key && performance.now() - since >= SETTLE_MS) {
        setShown({ key, path: pathname, immersive: document.body.dataset.immersive !== undefined })
        onSeen(key)
        track('tip_seen', { key })
      }
    }
    const timer = window.setInterval(check, 400)
    return () => window.clearInterval(timer)
  }, [tip, seen, pathname, onSeen])

  const Icon = tip ? ICONS[tip] : Lightbulb
  const offset = immersive ? -12 : 12

  return (
    <AnimatePresence>
      {tip && (
        <motion.aside
          key={tip}
          role="status"
          aria-live="polite"
          aria-label={t.label}
          className={cn(
            'card-raised fixed inset-x-3 z-[45] mx-auto flex max-w-md items-start gap-3 rounded-2xl py-3 pr-2 pl-3.5',
            immersive
              ? 'top-[calc(var(--header-h)+0.5rem)]'
              : 'bottom-[calc(var(--tabbar-h)+0.75rem)]',
          )}
          initial={{ opacity: 0, y: reduce ? 0 : offset, scale: reduce ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } }}
          exit={{
            opacity: 0,
            y: reduce ? 0 : offset,
            transition: { duration: 0.16, ease: EASE_OUT },
          }}
        >
          <span aria-hidden className="icon-tile bg-accent/15 text-accent mt-0.5">
            <Icon className="size-[1.0625rem]" strokeWidth={2.2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
            <p className="text-callout font-semibold text-pretty">{t[tip].title}</p>
            <p className="text-muted text-footnote text-pretty">{t[tip].text}</p>
          </div>
          <button
            type="button"
            onClick={() => setShown(null)}
            className="text-accent text-callout active:bg-accent/10 flex h-11 shrink-0 items-center self-center rounded-full px-3 font-semibold transition-[background-color,scale] duration-150 ease-out active:scale-[0.96]"
          >
            {t.gotIt}
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
