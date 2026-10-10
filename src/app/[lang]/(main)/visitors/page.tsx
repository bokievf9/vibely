import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { VisitorsList } from '@/features/vip-perks/components/visitors-list'
import { PlansChip } from '@/features/plans/components/plan-entries'
import { getProfileVisitors } from '@/features/vip-perks/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).vipPerks.visitors.title, robots: { index: false } }
}

export default async function VisitorsPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.vipPerks.visitors.title}
        back={{ href: '/profile', label: dict.common.back }}
      >
        <Suspense fallback={null}>
          <PlansChip />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<VisitorsSkeleton />}>
        <Visitors />
      </Suspense>
    </>
  )
}

// The list is loaded server-side only; a non-VIP gets the count (my_profile_visitors decides).
async function Visitors() {
  const data = await getProfileVisitors()
  // Before 20261009000290 there is nothing to show.
  if (!data) notFound()
  return <VisitorsList data={data} />
}

function VisitorsSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-1" aria-busy="true">
      <Skeleton className="h-4 w-2/3 rounded-full" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-4 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  )
}
