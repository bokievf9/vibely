import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiscoverSkeleton } from '@/features/swipe/components/deck-skeleton'
import { getViewer } from '@/features/auth/session'
import { CrossedPathsStrip } from '@/features/crossed-paths/components/crossed-paths-strip'
import { CrushCard } from '@/features/crush/components/crush-card'
import { EventWidget } from '@/features/events/components/event-widget'
import { getCurrentEvent } from '@/features/events/queries'
import { LikesButton } from '@/features/likes/components/likes-button'
import { getOwnProfile } from '@/features/profile/queries'
import { StatusCarousel } from '@/features/statuses/components/status-carousel'
import { getStatuses } from '@/features/statuses/queries'
import { SwipeDeck } from '@/features/swipe/components/swipe-deck'
import { SearchButton } from '@/features/username/components/search-button'
import { getDictionary } from '@/i18n/server'
import { DuoDiscover } from '@/features/duo/components/duo-discover'
import { DiscoverModeToggle } from '@/features/duo/components/mode-toggle'
import { getMyDuo, getOwnDuoPerson } from '@/features/duo/queries'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).swipe.title }
}

export default function SwipePage({ searchParams }: PageProps<'/[lang]/swipe'>) {
  return (
    <Suspense fallback={<DiscoverSkeleton />}>
      <Deck searchParams={searchParams} />
    </Suspense>
  )
}

async function Deck({ searchParams }: Pick<PageProps<'/[lang]/swipe'>, 'searchParams'>) {
  const [viewer, query] = await Promise.all([getViewer(), searchParams])
  const [profile, duo, statuses] = viewer
    ? await Promise.all([getOwnProfile(viewer.id), getMyDuo(), getStatuses()])
    : [null, undefined, null]
  // Duo mode (?mode=duo) once Duo Dating exists on this database (migration 20261009000261).
  // Live statuses are a Solo thing: the Duo deck has no carousel.
  if (viewer && duo && query.mode === 'duo') {
    return (
      <DuoDiscover
        initial={duo}
        me={await getOwnDuoPerson(viewer.id)}
        openInbox={query.inbox === '1'}
        headerActions={<SearchButton />}
      />
    )
  }
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
        // "Similar statuses" needs live statuses (migration 20261009000271).
        similarAvailable={statuses !== null}
        headerLeading={duo ? <DiscoverModeToggle mode="solo" /> : undefined}
        headerActions={
          <>
            <SearchButton />
            <Suspense fallback={null}>
              <LikesButton />
            </Suspense>
          </>
        }
        banner={
          <>
            {statuses && <StatusCarousel initial={statuses} compact className="-mx-3" />}
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
