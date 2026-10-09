import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiscoverSkeleton } from '@/features/swipe/components/deck-skeleton'
import { getViewer } from '@/features/auth/session'
import { CrossedPathsStrip } from '@/features/crossed-paths/components/crossed-paths-strip'
import { CrushCard } from '@/features/crush/components/crush-card'
import { PlanButton } from '@/features/plans/components/plan-picker'
import { getOwnPlan } from '@/features/plans/queries'
import { EventWidget } from '@/features/events/components/event-widget'
import { getCurrentEvent } from '@/features/events/queries'
import { LikesButton } from '@/features/likes/components/likes-button'
import { getOwnProfile } from '@/features/profile/queries'
import { StatusCarousel } from '@/features/statuses/components/status-carousel'
import { getStatuses } from '@/features/statuses/queries'
import { SwipeDeck } from '@/features/swipe/components/swipe-deck'
import { SearchButton } from '@/features/username/components/search-button'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).swipe.title }
}

export default function SwipePage() {
  return (
    <Suspense fallback={<DiscoverSkeleton />}>
      <Deck />
    </Suspense>
  )
}

async function Deck() {
  const viewer = await getViewer()
  const [profile, plan, statuses] = viewer
    ? await Promise.all([getOwnProfile(viewer.id), getOwnPlan(viewer.id), getStatuses()])
    : [null, undefined, null]
  // Until the user changes filters, show who they said they're interested in.
  return (
    <>
      <SwipeDeck
        defaultFilters={{
          genders: profile?.interestedIn ?? ['female', 'male'],
          minAge: 18,
          maxAge: 45,
          maxKm: 50,
        }}
        aboveDeck={<CrossedPathsStrip />}
        plansAvailable={plan !== undefined}
        headerActions={
          <>
            {/* With live statuses the own bubble of the carousel opens the one "What's your
                vibe?" sheet (status + plan); without them the plan keeps its own picker. */}
            {plan !== undefined && !statuses && <PlanButton initial={plan} variant="icon" />}
            <SearchButton />
            <Suspense fallback={null}>
              <LikesButton />
            </Suspense>
          </>
        }
        banner={
          <>
            {statuses && <StatusCarousel initial={statuses} plan={plan} className="-mx-3" />}
            <Suspense fallback={null}>
              <NightBanner />
            </Suspense>
          </>
        }
      />
      {/* Joined through a crush invite link: the one-time card, once verified. */}
      <CrushCard />
    </>
  )
}

// The next (or live) Blind Dating Night, above the deck. Nothing when there is none.
async function NightBanner() {
  const event = await getCurrentEvent()
  return event ? <EventWidget initial={event} className="mx-1 shrink-0" /> : null
}
