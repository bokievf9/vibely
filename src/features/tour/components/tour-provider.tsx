'use client'

import {
  createContext,
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'
import { saveTipSeen, saveTourEnd } from '../actions'
import { addLocalTip, readLocal, writeLocal } from '../storage'
import {
  isTourAllowedPath,
  mergeSeen,
  shouldAutoStart,
  type ServerTourState,
  type TipKey,
} from '../steps'
import { TipHost } from './tip-host'
import { TourOverlay } from './tour-overlay'

type Ctx = {
  // Settings, "Replay the tour": straight into the steps, from Discover.
  replay: () => void
  active: boolean
}

const TourContext = createContext<Ctx | null>(null)

export function useTour(): Ctx | null {
  return use(TourContext)
}

type Phase = { kind: 'idle' } | { kind: 'tour'; welcome: boolean }

// The guided tour and the one-time tips for the (main) layout. The server state (my_tour_state,
// or the account age before that migration) arrives as a promise and is read under a Suspense
// boundary, so the layout never waits for it. The tour opens by itself once, on Discover, for new
// accounts; while it runs, body[data-tour] hides the install banner (globals.css) and tips wait.
export function TourProvider({
  state,
  children,
}: {
  state: Promise<ServerTourState | null>
  children: ReactNode
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [server, setServer] = useState<ServerTourState | null>(null)
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())

  const markTip = useCallback((key: TipKey) => {
    setSeen((s) => (s.has(key) ? s : new Set([...s, key])))
    addLocalTip(key)
    void saveTipSeen(key).catch(() => {})
  }, [])

  const end = useCallback((kind: 'complete' | 'skip', step: number) => {
    setPhase({ kind: 'idle' })
    writeLocal({ done: kind })
    if (kind === 'complete') track('tour_complete')
    else track('tour_skip', { step })
    void saveTourEnd(kind, step).catch(() => {})
  }, [])

  const replay = useCallback(() => {
    track('tour_start', { source: 'replay' })
    setPhase({ kind: 'tour', welcome: false })
  }, [])

  const boot = useCallback((s: ServerTourState | null, autoStart: boolean) => {
    setServer(s)
    if (!s) return
    setSeen(mergeSeen(s.seenTips, readLocal().tips))
    if (autoStart) setPhase({ kind: 'tour', welcome: true })
  }, [])

  const active = phase.kind !== 'idle'
  useEffect(() => {
    if (!active) return
    document.body.dataset.tour = ''
    return () => {
      delete document.body.dataset.tour
    }
  }, [active])

  const ctx = useMemo(() => ({ replay, active }), [replay, active])

  return (
    <TourContext value={ctx}>
      {children}
      <Suspense fallback={null}>
        <TourBoot state={state} onBoot={boot} />
        <AnimatePresence>
          {phase.kind === 'tour' && (
            <AllowedPath key="tour">
              <TourOverlay
                welcome={phase.welcome}
                name={server?.name ?? ''}
                onEnd={end}
                onTip={markTip}
              />
            </AllowedPath>
          )}
        </AnimatePresence>
        {!active && server && <TipHost seen={seen} onSeen={markTip} />}
      </Suspense>
    </TourContext>
  )
}

// Reads the server state once, then decides about the automatic start (after the first paint,
// so Discover is on screen before the welcome card fades in over it).
function TourBoot({
  state,
  onBoot,
}: {
  state: Promise<ServerTourState | null>
  onBoot: (s: ServerTourState | null, autoStart: boolean) => void
}) {
  const s = use(state)
  // Where the user was when the state arrived; later navigation does not re-run the decision.
  const pathname = useRef(usePathname())
  useEffect(() => {
    const auto = s !== null && shouldAutoStart(s, readLocal(), pathname.current)
    if (!auto) return onBoot(s, false)
    const timer = window.setTimeout(() => {
      track('tour_start', { source: 'auto' })
      onBoot(s, true)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [s, onBoot])
  return null
}

// Never over a chat room, a call or anything outside the main tabs (the tour leaves those
// screens alone; it navigates to its own routes when a step needs one).
function AllowedPath({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return isTourAllowedPath(pathname) ? children : null
}
