'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { OwnPlan } from '@/features/plans/tags'
import { clearStatus, loadStatuses } from '../actions'
import { SEEN_KEY, orderStatuses, parseSeen, serializeSeen } from '../schemas'
import type { LiveStatus, StatusesState } from '../types'
import { StatusViewer } from './status-viewer'
import { VibeSheet } from './vibe-sheet'

type State = NonNullable<StatusesState>

// Refresh at most once a minute when the tab comes back (statuses last 3 hours).
const REFRESH_MS = 60_000

function readSeen(): Set<string> {
  try {
    return parseSeen(localStorage.getItem(SEEN_KEY))
  } catch {
    return new Set()
  }
}

function writeSeen(seen: Set<string>, live: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, serializeSeen(seen, live))
  } catch {
    // Not remembered: rings look unseen again next visit.
  }
}

// The seen set as an external store: read once from localStorage on the client, empty on the
// server (so the first client render matches the server HTML, then the rings update).
const EMPTY = new Set<string>()
const listeners = new Set<() => void>()
let seenCache: Set<string> | null = null
const getSeen = () => (seenCache ??= readSeen())
const subscribeSeen = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function addSeen(id: string, live: string[]) {
  const current = getSeen()
  if (current.has(id)) return
  seenCache = new Set(current).add(id)
  writeSeen(seenCache, live)
  listeners.forEach((l) => l())
}

type Props = {
  initial: State
  // undefined: plans not available (migration 20261009000200 missing).
  plan: OwnPlan | null | undefined
  className?: string
}

// "Like stories" at the top of Discover and Feed: your own bubble first ("+" to share your vibe),
// then live statuses of compatible people nearby. Unseen ones have the gradient ring; the seen
// state lives in this browser only (localStorage).
export function StatusCarousel({ initial, plan: initialPlan, className }: Props) {
  const { dict } = useI18n()
  const t = dict.statuses
  const [state, setState] = useState(initial)
  const [plan, setPlan] = useState(initialPlan ?? null)
  const seen = useSyncExternalStore(subscribeSeen, getSeen, () => EMPTY)
  const [sheet, setSheet] = useState(false)
  const [ownOpen, setOwnOpen] = useState(false)
  const [viewer, setViewer] = useState<{ items: LiveStatus[]; start: number } | null>(null)
  const loadedAt = useRef(0)

  useEffect(() => {
    loadedAt.current = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - loadedAt.current < REFRESH_MS) return
      loadedAt.current = Date.now()
      void loadStatuses()
        .then((next) => next && setState(next))
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const liveIds = useMemo(() => state.people.map((p) => p.id), [state.people])
  const ordered = useMemo(() => orderStatuses(state.people, seen), [state.people, seen])

  const markSeen = useCallback((id: string) => addSeen(id, liveIds), [liveIds])

  const own = state.own
  const openOwn = () => (own ? setOwnOpen(true) : setSheet(true))

  return (
    <>
      <section aria-label={t.title} className={cn('shrink-0', className)}>
        <ul className="flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain px-3 py-1 [&::-webkit-scrollbar]:hidden">
          <li className="shrink-0 snap-start">
            <Bubble
              label={own ? t.textLabel : t.add}
              name={t.you}
              ring={own ? (own.held ? 'held' : 'unseen') : 'none'}
              onClick={openOwn}
              emoji={own?.emoji}
              avatar={<Avatar photo={state.me.photo} alt="" size={60} />}
              plus={!own}
            />
          </li>
          {ordered.map((s) => (
            <li key={s.id} className="shrink-0 snap-start">
              <Bubble
                label={fmt(t.open, { name: s.name })}
                name={s.name}
                ring={seen.has(s.id) ? 'seen' : 'unseen'}
                emoji={s.emoji}
                avatar={<Avatar photo={s.photo} alt="" size={60} />}
                onClick={() =>
                  setViewer({ items: ordered, start: ordered.findIndex((x) => x.id === s.id) })
                }
              />
            </li>
          ))}
          {!state.people.length && !own && (
            <li className="flex max-w-56 shrink-0 items-center">
              <button
                type="button"
                onClick={() => setSheet(true)}
                className="text-muted text-footnote text-left text-pretty"
              >
                {t.emptyHint}
              </button>
            </li>
          )}
        </ul>
      </section>

      <VibeSheet
        key={own?.id ?? 'new'}
        open={sheet}
        own={own}
        plan={plan}
        onClose={() => setSheet(false)}
        onStatus={(next) => setState((s) => ({ ...s, own: next }))}
        onPlan={setPlan}
      />

      {ownOpen && own && (
        <StatusViewer
          mode="own"
          own={own}
          me={state.me}
          onClose={() => setOwnOpen(false)}
          onChange={() => {
            setOwnOpen(false)
            setSheet(true)
          }}
          onClear={() => {
            setOwnOpen(false)
            setState((s) => ({ ...s, own: null }))
            void clearStatus()
          }}
        />
      )}

      {viewer && (
        <StatusViewer
          mode="people"
          items={viewer.items}
          start={Math.max(0, viewer.start)}
          onSeen={markSeen}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )
}

type Ring = 'unseen' | 'seen' | 'held' | 'none'

function Bubble({
  label,
  name,
  ring,
  emoji,
  avatar,
  plus,
  onClick,
}: {
  label: string
  name: string
  ring: Ring
  emoji?: string
  avatar: React.ReactNode
  plus?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex w-[4.5rem] flex-col items-center gap-1 transition-[transform,scale] duration-150 ease-out active:scale-[0.95]"
    >
      <span className="relative">
        <span
          className={cn(
            'block rounded-full p-[2.5px]',
            ring === 'unseen' && 'bg-accent-gradient',
            ring === 'seen' && 'bg-border',
            ring === 'held' && 'bg-amber-400',
            ring === 'none' && 'bg-transparent',
          )}
        >
          <span className="bg-background block rounded-full p-[2px]">{avatar}</span>
        </span>
        {plus ? (
          <span
            aria-hidden
            className="bg-accent-gradient absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full text-white shadow-[0_0_0_2px_var(--background)]"
          >
            <Plus className="size-4" strokeWidth={3} />
          </span>
        ) : (
          emoji && (
            <span
              aria-hidden
              className="bg-surface-raised absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full text-base shadow-[0_0_0_2px_var(--background)]"
            >
              {emoji}
            </span>
          )
        )}
      </span>
      <span className="text-caption w-full truncate text-center">{name}</span>
    </button>
  )
}
