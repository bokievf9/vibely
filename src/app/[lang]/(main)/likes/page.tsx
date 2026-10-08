import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { LIKES_VISIBLE_FREE } from '@/features/likes/config'
import { LikesGrid } from '@/features/likes/components/likes-grid'
import { LikesSkeleton } from '@/features/likes/components/likes-skeleton'
import { countIncomingLikes, getIncomingLikes } from '@/features/likes/queries'
import { fmt } from '@/i18n/config'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).likes.title, robots: { index: false } }
}

export default async function LikesPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.likes.title} back={{ href: '/swipe', label: dict.common.back }} />
      <Suspense fallback={<LikesSkeleton />}>
        <Likes />
      </Suspense>
    </>
  )
}

async function Likes() {
  // Without the free flag the list is never loaded: only the count reaches the browser.
  if (LIKES_VISIBLE_FREE) return <LikesGrid initial={await getIncomingLikes()} />
  const [count, dict] = await Promise.all([countIncomingLikes(), getDictionary()])
  return (
    <EmptyState
      icon={Heart}
      title={count > 0 ? fmt(dict.likes.lockedTitle, { count }) : dict.likes.empty}
      text={count > 0 ? dict.likes.lockedHint : dict.likes.emptyHint}
    />
  )
}
