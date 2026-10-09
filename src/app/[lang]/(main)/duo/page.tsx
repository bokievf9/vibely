import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Spinner } from '@/components/ui/spinner'
import { getViewer } from '@/features/auth/session'
import { DuoEditor } from '@/features/duo/components/duo-editor'
import { DuoSetupPage } from '@/features/duo/components/duo-setup-page'
import { getMyDuo, getOwnDuoPerson } from '@/features/duo/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).duo.teamTitle }
}

export default async function DuoPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.duo.teamTitle}
        back={{ href: '/swipe?mode=duo', label: dict.common.back }}
      />
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        }
      >
        <Duo />
      </Suspense>
    </>
  )
}

// The duo profile editor (active duo) or the setup (no duo yet).
async function Duo() {
  const viewer = await getViewer()
  const duo = viewer ? await getMyDuo() : undefined
  if (!viewer || !duo) notFound()
  const team = duo.team?.status === 'active' ? duo.team : null
  const me = team ? await getOwnDuoPerson(viewer.id) : null
  return (
    <div className="px-4 pt-2 pb-8">
      {team && me ? <DuoEditor team={team} me={me} /> : <DuoSetupPage initial={duo} />}
    </div>
  )
}
