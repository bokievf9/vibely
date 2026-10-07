import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { ReportCard } from '@/features/admin/components/report-card'
import { getOpenReportGroups } from '@/features/admin/queries/reports'

export const metadata: Metadata = { title: 'Жалобы' }

export default function ReportsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Жалобы</h1>
      <Suspense fallback={<PageSpinner />}>
        <Reports />
      </Suspense>
    </>
  )
}

async function Reports() {
  const groups = await getOpenReportGroups()
  if (!groups.length) return <p className="text-muted">Открытых жалоб нет 🎉</p>
  return (
    <ul className="flex flex-col gap-4">
      {groups.map((g) => (
        <li key={`${g.targetType}:${g.targetId}`}>
          <ReportCard group={g} />
        </li>
      ))}
    </ul>
  )
}
