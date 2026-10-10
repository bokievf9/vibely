import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentHistoryList } from '@/features/payments/components/payment-history'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).payments.history.title, robots: { index: false } }
}

// The viewer's plan purchases (my_payments, 20261011000100), newest first.
export default async function PaymentHistoryPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.payments.history.title}
        back={{ href: '/settings', label: dict.common.back }}
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-2 px-4" aria-busy="true">
            <Skeleton className="h-16 rounded-[var(--radius-card)]" />
            <Skeleton className="h-16 rounded-[var(--radius-card)]" />
          </div>
        }
      >
        <PaymentHistoryList />
      </Suspense>
    </>
  )
}
