import { Suspense } from 'react'
import type { Metadata } from 'next'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { TestCheckout } from '@/features/payments/components/test-checkout'
import { planPeriodLabel } from '@/features/payments/labels'
import { getCheckoutMode, getMyOrder } from '@/features/payments/queries'
import { formatSen } from '@/features/plans/pricing'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).payments.test.title, robots: { index: false } }
}

// The test gateway's checkout (?order=<id>): staff only, outside production or with
// PAYMENT_TEST_MODE=true. Everyone else sees "not available"; nothing here can take money.
export default async function TestCheckoutPage({
  searchParams,
}: PageProps<'/[lang]/plans/checkout/test'>) {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.payments.test.title}
        back={{ href: '/plans', label: dict.common.back }}
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4 px-4" aria-busy="true">
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
            <Skeleton className="h-28 rounded-[var(--radius-card)]" />
          </div>
        }
      >
        <Checkout searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Checkout({
  searchParams,
}: Pick<PageProps<'/[lang]/plans/checkout/test'>, 'searchParams'>) {
  const [dict, mode, params] = await Promise.all([getDictionary(), getCheckoutMode(), searchParams])
  const id = z.uuid().safeParse(typeof params.order === 'string' ? params.order : '')
  const order = mode.kind === 'test' && id.success ? await getMyOrder(id.data) : null
  if (!order || order.provider !== 'test') {
    return <p className="card text-callout mx-4 px-4 py-3">{dict.payments.test.unavailable}</p>
  }
  if (order.status !== 'pending') {
    return <p className="card text-callout mx-4 px-4 py-3">{dict.payments.test.done}</p>
  }
  return (
    <TestCheckout
      orderId={order.id}
      title={planPeriodLabel(dict, order.plan, order.periodMonths)}
      amount={formatSen(order.amountSen)}
    />
  )
}
