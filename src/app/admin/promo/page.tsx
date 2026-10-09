import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { PromoManager } from '@/features/admin/components/promo-manager'
import { requireAdmin } from '@/features/admin/guard'
import { getPromoCodes } from '@/features/admin/queries/promo'

export const metadata: Metadata = { title: 'Промокоды' }

// Admin and owner only (404 for everyone else). Every change is logged in the journal.
export default function PromoPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Промокоды</h1>
      <p className="text-muted -mt-2 text-sm">
        Коды выдают план Plus или VIP на срок (складывается с уже действующим) и часы буста в
        Discover. Пол участников подтверждён проверкой селфи, поэтому код можно ограничить по полу.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <Promo />
      </Suspense>
    </>
  )
}

async function Promo() {
  await requireAdmin({ min: 'admin' })
  const codes = await getPromoCodes()
  if (!codes) {
    return (
      <p className="bg-surface rounded-2xl px-4 py-3 text-sm text-amber-400">
        Раздел недоступен: миграция 20261009000230_promo_vip ещё не применена к базе.
      </p>
    )
  }
  return <PromoManager codes={codes} />
}
