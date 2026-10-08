import { Suspense } from 'react'
import Link from 'next/link'
import { PageSpinner } from '@/components/ui/spinner'
import { TrendsSection } from '@/features/admin/components/trends-section'
import { getModerationStats } from '@/features/admin/queries/stats'

export default function AdminHome({ searchParams }: PageProps<'/admin'>) {
  return (
    <>
      <Suspense fallback={<PageSpinner />}>
        <Stats />
      </Suspense>
      <Suspense fallback={<PageSpinner />}>
        <Trends searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Trends({ searchParams }: Pick<PageProps<'/admin'>, 'searchParams'>) {
  const { days } = await searchParams
  return <TrendsSection days={days === '30' ? 30 : 7} />
}

async function Stats() {
  const s = await getModerationStats()
  const tiles = [
    { label: 'Селфи ждут проверки', value: s.pendingVerifications, href: '/admin/verification' },
    { label: 'Открытые жалобы', value: s.openReports, href: '/admin/reports' },
    { label: 'Заблокировано', value: s.bannedUsers, href: '/admin/users' },
    { label: 'Скрытые посты', value: s.hiddenPosts, href: '/admin/content?hidden=1' },
    { label: 'Новые фото за 24 ч', value: s.newPhotos, href: '/admin/photos?days=1' },
  ]
  return (
    <>
      <h1 className="text-2xl font-bold">Обзор</h1>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="bg-surface flex flex-col gap-1 rounded-2xl p-4">
              <span className="text-3xl font-bold tabular-nums">{t.value}</span>
              <span className="text-muted text-sm">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
