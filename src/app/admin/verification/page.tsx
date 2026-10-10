import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { VerificationCard } from '@/features/admin/components/verification-card'
import { getAdmin } from '@/features/admin/guard'
import { getPendingVerifications } from '@/features/admin/queries/verification'

export const metadata: Metadata = { title: 'Верификация' }

export default function VerificationQueuePage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Верификация селфи</h1>
      <Suspense fallback={<PageSpinner />}>
        <Queue />
      </Suspense>
    </>
  )
}

async function Queue() {
  const [requests, admin] = await Promise.all([getPendingVerifications(), getAdmin()])
  if (!requests.length) return <p className="text-muted">Очередь пуста 🎉</p>
  return (
    <ul className="flex flex-col gap-4">
      {requests.map((r) => (
        <li key={r.id}>
          <VerificationCard request={r} role={admin.role} />
        </li>
      ))}
    </ul>
  )
}
