import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { PromoRedemptions } from '@/features/admin/components/promo-redemptions'
import { requireAdmin } from '@/features/admin/guard'
import { getPromoCodes, getPromoRedemptions } from '@/features/admin/queries/promo'

export const metadata: Metadata = { title: 'Погашения промокода' }

// Who used one code (masked phone, @username, time, granted or waiting for the selfie check).
export default function PromoRedemptionsPage({ params }: PageProps<'/admin/promo/[id]'>) {
  return (
    <>
      <Link href="/admin/promo" className="text-muted flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden /> Все промокоды
      </Link>
      <Suspense fallback={<PageSpinner />}>
        <Redemptions params={params} />
      </Suspense>
    </>
  )
}

async function Redemptions({ params }: Pick<PageProps<'/admin/promo/[id]'>, 'params'>) {
  await requireAdmin({ min: 'admin' })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [codes, rows] = await Promise.all([getPromoCodes(), getPromoRedemptions(id)])
  const code = codes?.find((c) => c.id === id)
  if (!code) notFound()
  return <PromoRedemptions code={code} rows={rows} />
}
