import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { chipClassName } from '@/components/ui/chip'
import { PageSpinner } from '@/components/ui/spinner'
import { PhotoCard } from '@/features/admin/components/photo-card'
import { PHOTO_PERIODS, getRecentPhotos, type PhotoPeriod } from '@/features/admin/queries/photos'

export const metadata: Metadata = { title: 'Фото' }

const PERIOD_LABELS: Record<PhotoPeriod, string> = {
  1: '24 часа',
  3: '3 дня',
  7: 'Неделя',
  30: 'Месяц',
}

export default function PhotosPage({ searchParams }: PageProps<'/admin/photos'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Новые фото верифицированных</h1>
      <Suspense fallback={<PageSpinner />}>
        <Photos searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Photos({ searchParams }: Pick<PageProps<'/admin/photos'>, 'searchParams'>) {
  const { days: raw } = await searchParams
  const days = PHOTO_PERIODS.find((d) => String(d) === raw) ?? 3
  const photos = await getRecentPhotos(days)

  return (
    <>
      <nav aria-label="Период" className="flex flex-wrap gap-2">
        {PHOTO_PERIODS.map((d) => (
          <Link key={d} href={`/admin/photos?days=${d}`} className={chipClassName(d === days)}>
            {PERIOD_LABELS[d]}
          </Link>
        ))}
      </nav>
      {!photos.length ? (
        <p className="text-muted">Новых фото нет</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <PhotoCard photo={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
