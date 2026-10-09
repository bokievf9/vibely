'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, useMotionValue } from 'framer-motion'
import { Heart, SlidersHorizontal, X } from 'lucide-react'
import { headerActionClassName } from '@/components/layout/header-styles'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { trackOnce } from '@/lib/analytics'
import { loadCandidates, swipe } from '../actions'
import { setNewPeopleAlert } from '../deck-end-actions'
import type { Candidate, SwipeFilters } from '../schemas'
import { DeckEnd } from './deck-end'
import { DeckSkeleton } from './deck-skeleton'
import { FilterSheet } from './filter-sheet'
import { MatchModal, type MatchInfo } from './match-modal'
import { SwipeCard, type SwipeCardHandle } from './swipe-card'
import type { Direction } from './swipe-physics'
import { useSwipeFilters } from './use-swipe-filters'

const REFILL_AT = 3

type Props = {
  defaultFilters: SwipeFilters
  // Extra header buttons rendered by the server (e.g. "Who liked you" with its count).
  headerActions?: ReactNode
  // Optional strip above the deck (e.g. "You crossed paths"), rendered by the server.
  aboveDeck?: ReactNode
  // Plans exist on this database: the filter sheet offers "Similar plans first".
  plansAvailable?: boolean
}

// Pass is the quieter, smaller action; like is the big gradient one (Fitts: the likely tap is larger).
const passButton =
  'size-[3.75rem] rounded-full border border-border bg-surface-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_10px_24px_-12px_rgb(0_0_0/0.9)] active:scale-[0.9] active:bg-fill'
const likeButton =
  'size-[4.75rem] rounded-full active:scale-[0.9] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(0_0_0/0.12),0_14px_32px_-10px_rgb(255_77_125/0.7)]'

export function SwipeDeck({ defaultFilters, headerActions, aboveDeck, plansAvailable }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const { filters, setFilters } = useSwipeFilters(defaultFilters)
  const [cards, setCards] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [match, setMatch] = useState<MatchInfo | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The last card is still flying out: keep the stage mounted until it has left the screen.
  const [settling, setSettling] = useState(false)
  // Top card's drag progress (0..1), read by the back card without re-rendering the deck.
  const progress = useMotionValue(0)
  const topCard = useRef<SwipeCardHandle>(null)
  // Every card is decided once, even if a drag release and a button tap land together.
  const decided = useRef(new Set<string>())
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
        return [
          ...base,
          ...result.data.filter((c) => !seen.has(c.id) && !decided.current.has(c.id)),
        ]
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

  const decide = async (dir: Direction) => {
    const [top, ...rest] = cards
    if (!top || decided.current.has(top.id)) return
    decided.current.add(top.id)
    setCards(rest)
    if (rest.length === 0) setSettling(true)
    if (rest.length < REFILL_AT && !exhausted && !loading) void topUp()
    const result = await swipe({ targetId: top.id, direction: dir })
    if (!result.ok) return setError(result.error)
    if (!result.data.matchId) return
    trackOnce('first_match')
    setMatch({ id: result.data.matchId, name: top.name, photo: top.photos[0]?.url ?? null })
  }

  const [top, next] = cards

  // A new top card starts from rest: the back card waits at its resting scale again.
  useEffect(() => {
    progress.set(0)
  }, [top?.id, progress])

  // Buttons throw the card (same spring, same tilt as a flick); fall back to a plain decision.
  const press = (dir: Direction) => {
    if (topCard.current) topCard.current.fling(dir)
    else void decide(dir)
  }

  return (
    <>
      <PageHeader title={dict.swipe.title}>
        {headerActions}
        <button
          type="button"
          className={headerActionClassName}
          aria-label={dict.swipe.filters}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-[1.375rem]" />
        </button>
      </PageHeader>
      <section className="flex flex-1 flex-col gap-4 px-3 pt-1 pb-3">
        {aboveDeck}
        <FormError message={errorText(error)} />
        {!top && !settling && loading && <DeckSkeleton />}
        {!top && !settling && !loading && (
          <DeckEnd
            filters={filters}
            onWiden={changeFilters}
            onRefresh={() => void refresh()}
            onOpenFilters={() => setFiltersOpen(true)}
            onAlertChange={onAlertChange}
          />
        )}
        {(top || settling) && (
          <>
            {/* 360px (was 420px) so a compact strip above the deck still fits on a phone. */}
            <div className="relative min-h-[360px] flex-1">
              <AnimatePresence onExitComplete={() => setSettling(false)}>
                {[next, top].map(
                  (c) =>
                    c && (
                      <SwipeCard
                        key={c.id}
                        ref={c === top ? topCard : undefined}
                        candidate={c}
                        active={c === top}
                        progress={progress}
                        onSwipe={(dir) => void decide(dir)}
                      />
                    ),
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-center gap-7 pt-1">
              <Button
                variant="secondary"
                size="icon"
                className={passButton}
                aria-label={dict.swipe.pass}
                disabled={!top}
                onClick={() => press('pass')}
              >
                <X className="size-7 text-white/90" strokeWidth={2.75} />
              </Button>
              <Button
                size="icon"
                className={likeButton}
                aria-label={dict.swipe.like}
                disabled={!top}
                onClick={() => press('like')}
              >
                <Heart className="size-9 fill-current drop-shadow-[0_1px_1px_rgb(0_0_0/0.15)]" />
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
          plansAvailable={plansAvailable}
        />
      )}
      <MatchModal match={match} onClose={() => setMatch(null)} />
    </>
  )
}
