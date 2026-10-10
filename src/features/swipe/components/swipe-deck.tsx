'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, useMotionValue } from 'framer-motion'
import { Crown, Heart, MessageSquareHeart, SlidersHorizontal, X } from 'lucide-react'
import { headerActionClassName } from '@/components/layout/header-styles'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { trackOnce } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { loadCandidates, swipe, type SwipeResult } from '../actions'
import { LikeNoteSheet } from '@/features/vip-perks/components/like-note-sheet'
import { setNewPeopleAlert } from '../deck-end-actions'
import type { Candidate, SwipeFilters } from '../schemas'
import { DeckEnd } from './deck-end'
import { DeckSkeleton } from './deck-skeleton'
import { FilterSheet } from './filter-sheet'
import { MatchModal, type MatchInfo } from './match-modal'
import { SwipeCard, type SwipeCardHandle } from './swipe-card'
import type { Direction } from './swipe-physics'
import { useSwipeFilters } from './use-swipe-filters'
import { useAccess, useUpgradeHandler } from '@/features/plans/components/access-provider'

const REFILL_AT = 3

type Props = {
  defaultFilters: SwipeFilters
  // Left of the header bar, in place of the large title (the Solo/Duo switch).
  headerLeading?: ReactNode
  // Extra header buttons rendered by the server (e.g. "Who liked you" with its count).
  headerActions?: ReactNode
  // Optional strip above the deck (e.g. "You crossed paths"), rendered by the server.
  aboveDeck?: ReactNode
  // Plans exist on this database: the filter sheet offers "Similar plans first".
  similarAvailable?: boolean
  // Above the deck: the Blind Dating Night countdown (server-rendered, null when there is none).
  banner?: ReactNode
}

// Pass and "Like with a note" are the quieter, smaller actions on either side; like is the big
// gradient one in the middle (Fitts: the likely tap is larger).
const sideButton =
  'size-[3.75rem] rounded-full border border-border bg-surface-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_10px_24px_-12px_rgb(0_0_0/0.9)] active:scale-[0.9] active:bg-fill'
const likeButton =
  'size-[4.75rem] rounded-full active:scale-[0.9] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(0_0_0/0.12),0_14px_32px_-10px_rgb(255_77_125/0.7)]'

export function SwipeDeck({
  defaultFilters,
  headerLeading,
  headerActions,
  aboveDeck,
  similarAvailable,
  banner,
}: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const upgradeOr = useUpgradeHandler()
  // "Like with a note" (message_before_match, VIP): without it the button opens the upgrade sheet.
  const { has, showUpgrade, remaining, recordUse } = useAccess()
  // Daily likes (likes_per_day, free 100): a quiet line under the buttons once 10 or fewer are
  // left, so the limit never comes as a surprise. Tapping it opens the upgrade sheet.
  const likesLeft = remaining('likes_per_day')
  const { filters, setFilters } = useSwipeFilters(defaultFilters)
  const [cards, setCards] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [match, setMatch] = useState<MatchInfo | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [noting, setNoting] = useState<Candidate | null>(null)
  // The like already went out with a note: the card leaves without a second swipe() call.
  const noted = useRef(new Map<string, SwipeResult>())
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
    const viaNote = noted.current.get(top.id)
    const result = viaNote
      ? { ok: true as const, data: viaNote }
      : await swipe({ targetId: top.id, direction: dir })
    if (!result.ok) {
      // Daily like limit (VP402): the card comes back on top, the sheet says what Plus gives.
      if (upgradeOr(result)) {
        decided.current.delete(top.id)
        setCards((c) => [top, ...c.filter((x) => x.id !== top.id)])
        return
      }
      return setError(result.error)
    }
    // Keeps the "likes left today" line honest until the next request reads the real count.
    if (dir === 'like' && !viaNote) recordUse('likes_per_day')
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
      <PageHeader title={dict.swipe.title} leading={headerLeading}>
        {headerActions}
        <button
          type="button"
          className={headerActionClassName}
          aria-label={dict.swipe.filters}
          data-tour="swipe-filters"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-[1.375rem]" />
        </button>
      </PageHeader>
      {/* While the deck (or its skeleton) is up, the section is exactly the space between the
          header and the tab bar (deck-fit, globals.css) so the card shrinks instead of pushing the
          buttons under the tab bar. The end-of-deck screen keeps normal page scrolling. */}
      <section
        className={cn(
          'flex flex-1 flex-col gap-3 px-3 pt-1 pb-3',
          (top || settling || loading) && 'deck-fit min-h-0',
        )}
      >
        {/* Status carousel, event banner, crossed paths: full height while the card keeps at least
            its floor; on the shortest screens with all of them up this strip scrolls instead. */}
        <div
          data-deck-strips
          className="-mx-3 flex min-h-0 shrink [scrollbar-width:none] flex-col gap-3 overflow-y-auto overscroll-contain px-3 empty:hidden [&::-webkit-scrollbar]:hidden"
        >
          {banner}
          {aboveDeck}
        </div>
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
            {/* Takes whatever height is left; the 13rem floor keeps a usable card on a 568px
                screen (the strips above give way first, see data-deck-strips). */}
            <div className="relative min-h-[13rem] flex-1">
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
            {/* Like stays in the centre: equal columns on both sides of it. */}
            <div
              data-tour="swipe-deck"
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-7 pt-1"
            >
              <Button
                variant="secondary"
                size="icon"
                className={cn(sideButton, 'justify-self-end')}
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
              <Button
                variant="secondary"
                size="icon"
                className={cn(sideButton, 'justify-self-start')}
                aria-label={dict.vipPerks.note.button}
                disabled={!top}
                onClick={() => {
                  if (!top) return
                  if (!has('message_before_match')) {
                    return showUpgrade({ feature: 'message_before_match', reason: 'feature' })
                  }
                  setNoting(top)
                }}
              >
                <MessageSquareHeart className="text-accent size-6" strokeWidth={2.25} />
                {!has('message_before_match') && (
                  <span
                    aria-hidden
                    className="bg-surface-raised border-border absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border"
                  >
                    <Crown className="text-vip fill-vip/25 size-3" strokeWidth={2.5} />
                  </span>
                )}
              </Button>
            </div>
            {likesLeft !== null && likesLeft <= 10 && (
              <button
                type="button"
                onClick={() =>
                  showUpgrade({
                    feature: 'likes_per_day',
                    reason: likesLeft === 0 ? 'limit' : 'feature',
                  })
                }
                className="text-muted text-footnote relative mx-auto -mt-1 font-medium tabular-nums before:absolute before:-inset-x-3 before:-inset-y-3 before:content-[''] active:opacity-60"
              >
                {likesLeft === 0
                  ? dict.plans.limitTitle
                  : fmt(dict.plans.likesLeft, { count: likesLeft })}
              </button>
            )}
          </>
        )}
      </section>
      {filtersOpen && (
        <FilterSheet
          open
          value={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={changeFilters}
          similarAvailable={similarAvailable}
        />
      )}
      {noting && (
        <LikeNoteSheet
          key={noting.id}
          open
          targetId={noting.id}
          onClose={() => setNoting(null)}
          onSent={(result) => {
            noted.current.set(noting.id, { matchId: result.matchId })
            setNoting(null)
            // The noted card leaves like a liked one (decide() skips the second like).
            if (cards[0]?.id === noting.id) press('like')
          }}
        />
      )}
      <MatchModal match={match} onClose={() => setMatch(null)} />
    </>
  )
}
