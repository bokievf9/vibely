'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, MapPin, Search, SearchX, TriangleAlert, X } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VerifiedBadge } from '@/components/ui/verified-badge'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { searchPeople } from '../actions'
import { SEARCH_MIN, normalizeUsername, type SearchResult } from '../schemas'

const DEBOUNCE_MS = 300

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; query: string }
  | { kind: 'error'; query: string }
  | { kind: 'done'; query: string; results: SearchResult[] }

// Search by @username or name. The query is mirrored in ?q= so "back" from a profile restores it.
export function UserSearch({ initialQuery }: { initialQuery: string }) {
  const { dict } = useI18n()
  const t = dict.username
  const [query, setQuery] = useState(initialQuery)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(0)
  const term = query.trim()
  const searchable = normalizeUsername(term).length >= SEARCH_MIN

  useEffect(() => {
    const url = new URL(window.location.href)
    if (term) url.searchParams.set('q', term)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url)
    if (!searchable) return
    const id = ++latest.current
    const timer = setTimeout(() => {
      setState({ kind: 'loading', query: term })
      searchPeople(term)
        .then(
          (r) =>
            id === latest.current &&
            setState(
              r.ok
                ? { kind: 'done', query: term, results: r.data }
                : { kind: 'error', query: term },
            ),
        )
        .catch(() => id === latest.current && setState({ kind: 'error', query: term }))
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [term, searchable, attempt])

  // Results of an older query stay visible (dimmed) until the new ones arrive.
  const view: State = !searchable
    ? { kind: 'idle' }
    : state.kind === 'idle'
      ? { kind: 'loading', query: term }
      : state

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-6">
      <form role="search" className="relative" onSubmit={(e) => e.preventDefault()}>
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          autoFocus={!initialQuery}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={40}
          className="h-12 rounded-[0.875rem] border-transparent bg-white/[0.07] pr-12 pl-11 shadow-[inset_0_1px_1px_rgb(0_0_0/0.25)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t.clear}
            className="text-muted absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X className="size-5" />
          </button>
        )}
      </form>

      {view.kind === 'idle' && <p className="text-muted text-footnote px-1">{t.searchHint}</p>}
      {view.kind === 'loading' && <ResultsSkeleton label={dict.common.loading} />}
      {view.kind === 'error' && (
        <EmptyState icon={TriangleAlert} title={t.searchFailed}>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t.retry}
          </Button>
        </EmptyState>
      )}
      {view.kind === 'done' && view.results.length === 0 && (
        <EmptyState icon={SearchX} title={t.searchEmpty} text={t.searchEmptyHint} />
      )}
      {view.kind === 'done' && view.results.length > 0 && (
        <ul
          aria-label={t.results}
          className={cn(
            'card divide-border flex flex-col divide-y overflow-hidden transition-opacity',
            view.query !== term && 'opacity-60',
          )}
        >
          {view.results.map((r) => (
            <li key={r.id}>
              <ResultRow result={r} label={fmt(t.openProfile, { name: r.name })} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResultRow({ result: r, label }: { result: SearchResult; label: string }) {
  return (
    <LocaleLink
      href={`/profile/${r.id}`}
      aria-label={label}
      className="active:bg-fill flex min-h-18 items-center gap-3.5 px-4 py-3"
    >
      <Avatar photo={r.photo} alt="" size={56} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1">
          <span className="text-headline truncate">{r.name}</span>
          <span className="text-headline shrink-0 font-normal text-white/80">, {r.age}</span>
          <VerifiedBadge size={16} className="shrink-0" />
        </span>
        <span className="text-muted text-callout truncate">@{r.username}</span>
        {r.city && (
          <span className="text-muted flex min-w-0 items-center gap-1 text-xs">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{r.city}</span>
          </span>
        )}
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </LocaleLink>
  )
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <ul aria-busy aria-label={label} className="card divide-border flex flex-col divide-y">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="bg-fill size-13 shrink-0 animate-pulse rounded-full" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="bg-fill h-4 w-2/5 animate-pulse rounded" />
            <span className="bg-fill h-3 w-1/3 animate-pulse rounded" />
          </span>
        </li>
      ))}
    </ul>
  )
}
