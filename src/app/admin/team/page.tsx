import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { TeamManager } from '@/features/admin/components/team-manager'
import { requireAdmin } from '@/features/admin/guard'
import { getTeam } from '@/features/admin/queries/team'

export const metadata: Metadata = { title: 'Команда' }

// Owner only (404 for everyone else). Every change is logged in the journal.
export default function TeamPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Команда модерации</h1>
      <Suspense fallback={<PageSpinner />}>
        <Team />
      </Suspense>
    </>
  )
}

async function Team() {
  const me = await requireAdmin({ min: 'owner' })
  const members = await getTeam()
  return <TeamManager members={members} me={me} />
}
