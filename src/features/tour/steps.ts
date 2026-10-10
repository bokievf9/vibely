// The guided tour and the one-time feature tips: what they point at and in which order. Pure
// data and functions (no React, no DOM), covered by tests/unit/tour.test.mjs.
//
// Targets are `data-tour` attributes on the real UI. One key may sit on several elements (the
// Discover header buttons): the spotlight then wraps all of them. Tips use `data-tip` markers: a
// tip shows the first time its marker is on screen.

export type TourRoute = '/swipe' | '/blind-date' | '/feed' | '/chats' | '/profile' | '/settings' | '/plans'

// Tab order of the app: the tour walks through it once, left to right, then into Settings.
export const ROUTE_ORDER: readonly TourRoute[] = [
  '/swipe',
  '/blind-date',
  '/feed',
  '/chats',
  '/profile',
  '/settings',
  '/plans',
]

export type TipKey =
  | 'duo'
  | 'statuses'
  | 'crossed_paths'
  | 'event'
  | 'visitors'
  | 'crush'
  | 'matchmaker'

export const TIP_KEYS: readonly TipKey[] = [
  'statuses',
  'crossed_paths',
  'event',
  'duo',
  'visitors',
  'crush',
  'matchmaker',
]

export type TourStepId =
  | 'deck'
  | 'filters'
  | 'statuses'
  | 'event'
  | 'crossed'
  | 'mode'
  | 'people'
  | 'blind'
  | 'feed'
  | 'chats'
  | 'profile'
  | 'settings'
  | 'plans'

export type TourStep = {
  id: TourStepId
  route: TourRoute
  // data-tour key of the element(s) to light up.
  target: string
  // Used when `target` never shows up (e.g. a date in progress hides the Blind date intro).
  fallback?: string
  // A feature that may be off for this user or this database (statuses, Duo, an event). When it
  // is missing the step is skipped without waiting long.
  optional?: boolean
  // Seeing this step counts as seeing the tip with the same subject.
  tip?: TipKey
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'deck', route: '/swipe', target: 'swipe-deck', fallback: 'tab-swipe' },
  { id: 'filters', route: '/swipe', target: 'swipe-filters' },
  { id: 'statuses', route: '/swipe', target: 'swipe-statuses', optional: true, tip: 'statuses' },
  { id: 'event', route: '/swipe', target: 'swipe-event', optional: true, tip: 'event' },
  { id: 'crossed', route: '/swipe', target: 'swipe-crossed', optional: true, tip: 'crossed_paths' },
  { id: 'mode', route: '/swipe', target: 'swipe-mode', optional: true },
  { id: 'people', route: '/swipe', target: 'swipe-people' },
  { id: 'blind', route: '/blind-date', target: 'blind-intro', fallback: 'tab-randomizer' },
  { id: 'feed', route: '/feed', target: 'feed-compose', fallback: 'tab-feed' },
  { id: 'chats', route: '/chats', target: 'tab-chats' },
  { id: 'profile', route: '/profile', target: 'profile-card', fallback: 'tab-profile' },
  { id: 'settings', route: '/settings', target: 'settings-privacy' },
  { id: 'plans', route: '/plans', target: 'plans-billing' },
]

// Waits for a step's target after the route is on screen. Optional features get less patience,
// counted from the moment the route appeared, so a missing one is skipped almost at once.
export const TARGET_TIMEOUT_MS = 5000
export const OPTIONAL_TIMEOUT_MS = 1500

export function targetTimeout(step: TourStep, msOnRoute: number): number {
  if (!step.optional) return TARGET_TIMEOUT_MS
  return Math.max(0, OPTIONAL_TIMEOUT_MS - msOnRoute)
}

// The next step to show from `from` in direction `dir` (+1 / -1), jumping over steps already found
// missing. Returns -1 before the first step and `steps.length` after the last.
export function stepAfter(
  steps: readonly TourStep[],
  from: number,
  dir: 1 | -1,
  missing: ReadonlySet<TourStepId>,
): number {
  let i = from + dir
  while (i >= 0 && i < steps.length && missing.has(steps[i]!.id)) i += dir
  return i < 0 ? -1 : Math.min(i, steps.length)
}

// The steps the user will see (for the dots): every step not known to be missing.
export function visibleSteps(
  steps: readonly TourStep[],
  missing: ReadonlySet<TourStepId>,
): TourStep[] {
  return steps.filter((s) => !missing.has(s.id))
}

// Steps must never walk backwards through the tabs: a step's route is never earlier in
// ROUTE_ORDER than the one before it (one pass, no ping-pong between screens).
export function routesInOrder(steps: readonly TourStep[]): boolean {
  let last = 0
  for (const s of steps) {
    const at = ROUTE_ORDER.indexOf(s.route)
    if (at < last) return false
    last = at
  }
  return true
}

// '/ms/swipe?mode=duo' → '/swipe'. Null outside the locale prefix.
export function appPath(pathname: string): string | null {
  const m = /^\/[a-z]{2}(?=[/?#]|$)(\/[^?#]*)?/.exec(pathname)
  if (!m) return null
  const rest = (m[1] ?? '/').replace(/\/+$/, '')
  return rest === '' ? '/' : rest
}

// Screens where the tour may open by itself: Discover, where a new user lands after sign-up.
// Replays work from any main screen.
export function isAutoStartPath(pathname: string): boolean {
  return appPath(pathname) === '/swipe'
}

// Never over the admin panel, sign-in and onboarding, legal pages, chat rooms or calls.
const BLOCKED = /^\/(admin|login|verify-otp|onboarding|selfie-verification|banned|terms|privacy|~offline)(\/|$)/
export function isTourAllowedPath(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return false
  const path = appPath(pathname)
  if (!path || BLOCKED.test(path)) return false
  // Rooms: /chats/<id>, /chats/group/<id>, /blind-date/<id>, /feed/<id>.
  return !/^\/(chats|blind-date|feed)\/.+/.test(path)
}

export type ServerTourState = {
  // False before migration 20261010000200: the device's own record is all there is.
  persisted: boolean
  completedAt: string | null
  skippedAt: string | null
  seenTips: string[]
  // The server's verdict: a new account that never finished or skipped the tour.
  auto: boolean
  name: string
}

export type LocalTourState = { done: 'complete' | 'skip' | null; tips: string[] }

// The tour opens by itself once: on Discover, for a new account, unless this device or the
// server already saw it end (completed or skipped).
export function shouldAutoStart(
  server: Pick<ServerTourState, 'auto' | 'completedAt' | 'skippedAt'>,
  local: LocalTourState,
  pathname: string,
): boolean {
  if (!server.auto || server.completedAt || server.skippedAt) return false
  if (local.done) return false
  return isAutoStartPath(pathname)
}

// Tips seen anywhere (server or this device).
export function mergeSeen(server: readonly string[], local: readonly string[]): Set<string> {
  return new Set([...server, ...local])
}

// The tip to show now: the first unseen one whose marker is on screen. One at a time.
export function nextTip(
  present: (key: TipKey) => boolean,
  seen: ReadonlySet<string>,
): TipKey | null {
  for (const key of TIP_KEYS) if (!seen.has(key) && present(key)) return key
  return null
}

// localStorage record ('vibely_tour'): tolerant of anything a previous version or a user wrote.
export function parseLocal(raw: string | null): LocalTourState {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null
    if (!v || typeof v !== 'object') return { done: null, tips: [] }
    const o = v as { done?: unknown; tips?: unknown }
    const done = o.done === 'complete' || o.done === 'skip' ? o.done : null
    const tips = Array.isArray(o.tips)
      ? o.tips.filter((t): t is string => typeof t === 'string').slice(0, 32)
      : []
    return { done, tips }
  } catch {
    return { done: null, tips: [] }
  }
}
