import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { LikesButton } from '@/features/likes/components/likes-button'
import { getOwnProfile } from '@/features/profile/queries'
import { SwipeDeck } from '@/features/swipe/components/swipe-deck'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).swipe.title }
}

export default function SwipePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
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
        <Suspense fallback={null}>
          <LikesButton />
        </Suspense>
      }
    />
  )
}
