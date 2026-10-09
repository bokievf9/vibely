import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { LikesGrid } from '@/features/likes/components/likes-grid'
import { LikesSkeleton } from '@/features/likes/components/likes-skeleton'
import { countIncomingLikes, getIncomingLikes } from '@/features/likes/queries'
import { BlurredLikes } from '@/features/likes/components/blurred-likes'
import { hasFeature } from '@/features/plans/access'
import { getAccess } from '@/features/plans/queries'
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
  // "Who liked you" is a Plus feature (20261009000280). Without it the list is never loaded (the
  // database returns no rows either): only the count reaches the browser, as blurred tiles.
  if (hasFeature(await getAccess(), 'who_liked_you'))
    return <LikesGrid initial={await getIncomingLikes()} />
  const [count, dict] = await Promise.all([countIncomingLikes(), getDictionary()])
  if (count > 0) return <BlurredLikes count={count} dict={dict} />
  return <EmptyState icon={Heart} title={dict.likes.empty} text={dict.likes.emptyHint} />
}
