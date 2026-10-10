import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { LikesGrid } from '@/features/likes/components/likes-grid'
import { LikesSkeleton } from '@/features/likes/components/likes-skeleton'
import { countIncomingLikes, getIncomingLikes, getLockedLikeNotes } from '@/features/likes/queries'
import { BlurredLikes } from '@/features/likes/components/blurred-likes'
import { hasFeature } from '@/features/plans/access'
import { getAccess } from '@/features/plans/queries'
import { PlansChip } from '@/features/plans/components/plan-entries'
import { UpgradeCard } from '@/features/plans/components/upgrade-card'
import { LockedNotes } from '@/features/vip-perks/components/locked-notes'
import { VisitorsEntry } from '@/features/vip-perks/components/visitors-entry'
import { getProfileVisitors } from '@/features/vip-perks/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).likes.title, robots: { index: false } }
}

export default async function LikesPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.likes.title} back={{ href: '/swipe', label: dict.common.back }}>
        <Suspense fallback={null}>
          <PlansChip />
        </Suspense>
      </PageHeader>
      <Suspense fallback={null}>
        <Visitors />
      </Suspense>
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
  const [count, dict, notes] = await Promise.all([
    countIncomingLikes(),
    getDictionary(),
    getLockedLikeNotes(),
  ])
  // No likes yet: still say that Plus shows who they are, once they come.
  if (count === 0)
    return (
      <>
        <EmptyState icon={Heart} title={dict.likes.empty} text={dict.likes.emptyHint} />
        <UpgradeCard
          feature="who_liked_you"
          compact
          text={dict.plans.likesBlurredBody}
          className="mx-4 mb-6 w-auto"
        />
      </>
    )
  return (
    <>
      <BlurredLikes count={count} dict={dict} />
      {notes.length > 0 && <LockedNotes notes={notes} />}
    </>
  )
}

// "Who viewed your profile" above the likes; hidden before 20261009000290.
async function Visitors() {
  const visitors = await getProfileVisitors()
  return visitors && <VisitorsEntry count={visitors.count} className="mx-4 mb-4" />
}
