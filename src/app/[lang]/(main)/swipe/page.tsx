import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiscoverSkeleton } from '@/features/swipe/components/deck-skeleton'
import { getViewer } from '@/features/auth/session'
import { EventWidget } from '@/features/events/components/event-widget'
import { getCurrentEvent } from '@/features/events/queries'
import { LikesButton } from '@/features/likes/components/likes-button'
import { getOwnProfile } from '@/features/profile/queries'
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
  const profile = viewer && (await getOwnProfile(viewer.id))
  // Until the user changes filters, show who they said they're interested in.
  return (
    <SwipeDeck
      defaultFilters={{
        genders: profile?.interestedIn ?? ['female', 'male'],
        minAge: 18,
        maxAge: 45,
        maxKm: 50,
      }}
      headerActions={
        <>
          <SearchButton />
          <Suspense fallback={null}>
            <LikesButton />
          </Suspense>
        </>
      }
      banner={
        <Suspense fallback={null}>
          <NightBanner />
        </Suspense>
      }
    />
  )
}

// The next (or live) Blind Dating Night, above the deck. Nothing when there is none.
async function NightBanner() {
  const event = await getCurrentEvent()
  return event ? <EventWidget initial={event} className="mx-1" /> : null
}
