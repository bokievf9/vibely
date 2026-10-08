import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { PhotoGrid } from '@/features/admin/components/photo-grid'
import { FilterChips, Pager, pageParam } from '@/features/admin/components/reports-tabs'
import {
  PHOTO_PAGE_SIZE,
  PHOTO_PERIODS,
  PHOTO_SCOPES,
  getPhotoQueue,
  type PhotoPeriod,
  type PhotoScope,
} from '@/features/admin/queries/photos'

export const metadata: Metadata = { title: 'Фото' }

const PERIOD_LABELS: Record<PhotoPeriod, string> = {
  1: '24 часа',
  3: '3 дня',
  7: 'Неделя',
  30: 'Месяц',
}

const SCOPE_LABELS: Record<PhotoScope, string> = {
  pending: 'Ждут проверки',
  unverified: 'Неверифицированные',
  verified: 'Верифицированные',
  all: 'Все',
}

export default function PhotosPage({ searchParams }: PageProps<'/admin/photos'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Фото профилей</h1>
      <Suspense fallback={<PageSpinner />}>
        <Photos searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Photos({ searchParams }: Pick<PageProps<'/admin/photos'>, 'searchParams'>) {
  const sp = await searchParams
  const days = PHOTO_PERIODS.find((d) => String(d) === sp.days) ?? 7
  const scope = PHOTO_SCOPES.find((s) => s === sp.scope) ?? 'pending'
  const page = pageParam(sp.page)
  const { photos, total } = await getPhotoQueue(scope, days, page)

  const href = (next: { scope?: PhotoScope; days?: PhotoPeriod; page?: number }) => {
    const params = new URLSearchParams({
      scope: next.scope ?? scope,
      days: String(next.days ?? days),
    })
    if (next.page && next.page > 1) params.set('page', String(next.page))
    return `/admin/photos?${params}`
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <FilterChips
          label="Показать"
          options={PHOTO_SCOPES.map((s) => ({ value: s, label: SCOPE_LABELS[s] }))}
          value={scope}
          href={(s) => href({ scope: s ?? 'pending' })}
        />
        <FilterChips
          label="Загружены за"
          options={PHOTO_PERIODS.map((d) => ({ value: String(d), label: PERIOD_LABELS[d] }))}
          value={String(days)}
          href={(d) => href({ days: PHOTO_PERIODS.find((p) => String(p) === d) ?? 7 })}
        />
      </div>
      {!photos.length ? (
        <p className="text-muted">
          {scope === 'pending' ? 'Все новые фото проверены' : 'Фото за этот период нет'}
        </p>
      ) : (
        <PhotoGrid key={`${scope}:${days}:${page}`} photos={photos} />
      )}
      <Pager page={page} total={total} pageSize={PHOTO_PAGE_SIZE} href={(p) => href({ page: p })} />
    </>
  )
}
