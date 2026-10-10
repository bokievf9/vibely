import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { PlansScreen } from '@/features/plans/components/plans-screen'
import { getAccess, getPlanCatalog, getPlanInterest } from '@/features/plans/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).plans.screen.title, robots: { index: false } }
}

// Free, Plus and VIP with the comparison from the live matrix (features, plan_limits). Payments
// are not connected: the paid cards say "Coming soon" and record interest instead.
export default async function PlansPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.plans.screen.title}
        back={{ href: '/profile', label: dict.common.back }}
      />
      <Suspense fallback={<PlansSkeleton />}>
        <Plans />
      </Suspense>
    </>
  )
}

async function Plans() {
  const [access, catalog, interest] = await Promise.all([
    getAccess(),
    getPlanCatalog(),
    getPlanInterest(),
  ])
  return (
    <PlansScreen
      plan={access.plan}
      planUntil={access.planUntil}
      isStaff={access.isStaff}
      catalog={catalog}
      interest={interest}
    />
  )
}

function PlansSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4" aria-busy="true">
      <Skeleton className="h-4 w-4/5 rounded-full" />
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      <Skeleton className="h-96 rounded-[var(--radius-card)]" />
    </div>
  )
}
