import { Suspense } from 'react'
import type { Metadata } from 'next'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderStatusView } from '@/features/payments/components/order-status'
import { getMyOrder } from '@/features/payments/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).payments.return.title, robots: { index: false } }
}

// Where the gateway (or the test checkout) sends the user back: ?order=<id>. Shows the order's
// status from the database and polls while it is pending.
export default async function PaymentReturnPage({
  searchParams,
}: PageProps<'/[lang]/plans/return'>) {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.payments.return.title}
        back={{ href: '/plans', label: dict.common.back }}
      />
      <Suspense fallback={<ReturnSkeleton />}>
        <Return searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Return({ searchParams }: Pick<PageProps<'/[lang]/plans/return'>, 'searchParams'>) {
  const raw = (await searchParams).order
  const id = z.uuid().safeParse(typeof raw === 'string' ? raw : '')
  const order = id.success ? await getMyOrder(id.data) : null
  return (
    <OrderStatusView
      key={id.success ? id.data : 'none'}
      orderId={id.success ? id.data : ''}
      initial={order && { status: order.status, plan: order.plan }}
    />
  )
}

function ReturnSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-6" aria-busy="true">
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-6 w-2/3 rounded-full" />
      <Skeleton className="h-4 w-4/5 rounded-full" />
    </div>
  )
}
