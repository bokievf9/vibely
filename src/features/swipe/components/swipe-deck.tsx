'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Heart, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { PageSpinner } from '@/components/ui/spinner'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { trackOnce } from '@/lib/analytics'
import { loadCandidates, swipe } from '../actions'
import { setNewPeopleAlert } from '../deck-end-actions'
import type { Candidate, SwipeFilters } from '../schemas'
import { DeckEnd } from './deck-end'
import { FilterSheet } from './filter-sheet'
import { MatchModal } from './match-modal'
import { SwipeCard } from './swipe-card'
import { useSwipeFilters } from './use-swipe-filters'

const REFILL_AT = 3

type Props = {
  defaultFilters: SwipeFilters
  // Extra header buttons rendered by the server (e.g. "Who liked you" with its count).
  headerActions?: ReactNode
}

export function SwipeDeck({ defaultFilters, headerActions }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const { filters, setFilters } = useSwipeFilters(defaultFilters)
  const [cards, setCards] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [direction, setDirection] = useState<'like' | 'pass'>('like')
  const [match, setMatch] = useState<{ id: string; name: string } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Known once the deck-end screen loaded; new filters are then saved for "new people" alerts too.
  const alertOn = useRef(false)
  const onAlertChange = useCallback((on: boolean) => {
    alertOn.current = on
  }, [])

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof loadCandidates>>, replace: boolean) => {
      setLoading(false)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      setExhausted(result.data.length === 0)
      setCards((prev) => {
        const base = replace ? [] : prev
        const seen = new Set(base.map((c) => c.id))
        return [...base, ...result.data.filter((c) => !seen.has(c.id))]
      })
    },
    [],
  )

  // (Re)load the deck whenever filters change.
  useEffect(() => {
    let cancelled = false
    void loadCandidates(filters).then((result) => !cancelled && apply(result, true))
    return () => {
      cancelled = true
    }
  }, [filters, apply])

  const changeFilters = (next: SwipeFilters) => {
    setFiltersOpen(false)
    setLoading(true)
    setCards([])
    setFilters(next)
    if (alertOn.current) void setNewPeopleAlert({ enabled: true, filters: next })
  }

  const topUp = async () => {
    setLoading(true)
    apply(await loadCandidates(filters), false)
  }

  // Empty deck: ask again (new people may have joined or come into range).
  const refresh = async () => {
    setLoading(true)
    apply(await loadCandidates(filters), true)
  }

  const decide = async (dir: 'like' | 'pass') => {
    const [top, ...rest] = cards
    if (!top) return
    setDirection(dir)
    setCards(rest)
    if (rest.length < REFILL_AT && !exhausted && !loading) void topUp()
    const result = await swipe({ targetId: top.id, direction: dir })
    if (!result.ok) return setError(result.error)
    if (!result.data.matchId) return
    trackOnce('first_match')
    setMatch({ id: result.data.matchId, name: top.name })
  }

  const [top, next] = cards

  return (
    <>
      <PageHeader title={dict.swipe.title}>
        {headerActions}
        <Button
          variant="ghost"
          size="icon"
          aria-label={dict.swipe.filters}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-6" />
        </Button>
      </PageHeader>
      <section className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <FormError message={errorText(error)} />
        {!top && loading && <PageSpinner />}
        {!top && !loading && (
          <DeckEnd
            filters={filters}
            onWiden={changeFilters}
            onRefresh={() => void refresh()}
            onOpenFilters={() => setFiltersOpen(true)}
            onAlertChange={onAlertChange}
          />
        )}
        {top && (
          <>
            <div className="relative min-h-[420px] flex-1">
              <AnimatePresence custom={direction}>
                {[next, top].map(
                  (c) =>
                    c && <SwipeCard key={c.id} candidate={c} active={c === top} onSwipe={decide} />,
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="secondary"
                size="icon"
                className="size-16 rounded-full"
                aria-label={dict.swipe.pass}
                onClick={() => decide('pass')}
              >
                <X className="size-8 text-red-400" />
              </Button>
              <Button
                size="icon"
                className="size-16 rounded-full"
                aria-label={dict.swipe.like}
                onClick={() => decide('like')}
              >
                <Heart className="size-8 fill-current" />
              </Button>
            </div>
          </>
        )}
      </section>
      {filtersOpen && (
        <FilterSheet
          open
          value={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={changeFilters}
        />
      )}
      <MatchModal match={match} onClose={() => setMatch(null)} />
    </>
  )
}
