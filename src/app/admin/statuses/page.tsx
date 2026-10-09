import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { FilterChips, Pager, pageParam } from '@/features/admin/components/reports-tabs'
import { StatusQueue } from '@/features/admin/components/status-queue'
import { getAdmin } from '@/features/admin/guard'
import {
  STATUS_FILTERS,
  STATUS_PAGE_SIZE,
  getStatusQueue,
  type StatusFilter,
} from '@/features/admin/queries/statuses'
import { hasRole } from '@/features/admin/roles'

export const metadata: Metadata = { title: 'Статусы' }

const FILTER_LABELS: Record<StatusFilter, string> = {
  held: 'На проверке',
  reported: 'С жалобами',
  recent: 'За 7 дней',
}

export default function StatusesPage({ searchParams }: PageProps<'/admin/statuses'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Статусы</h1>
      <p className="text-muted text-sm">
        Статус (эмодзи и до 60 символов) виден людям рядом 3 часа. Если автоматическая проверка
        находит телефон, ссылку, мессенджер, деньги или ключевое слово, статус ждёт решения здесь и
        виден только автору. Одобрение или удаление закрывает жалобы на статус и пишется в журнал.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Queue({ searchParams }: Pick<PageProps<'/admin/statuses'>, 'searchParams'>) {
  const sp = await searchParams
  const filter = STATUS_FILTERS.find((f) => f === sp.filter) ?? 'held'
  const page = pageParam(sp.page)
  const [{ statuses, total, available }, admin] = await Promise.all([
    getStatusQueue(filter, page),
    getAdmin(),
  ])
  if (!available) {
    return (
      <p className="text-muted">
        Статусы ещё не созданы: примените миграции 20261009000270 и 20261009000271.
      </p>
    )
  }
  const href = (next: { filter?: StatusFilter; page?: number }) => {
    const params = new URLSearchParams({ filter: next.filter ?? filter })
    if (next.page && next.page > 1) params.set('page', String(next.page))
    return `/admin/statuses?${params}`
  }
  return (
    <>
      <FilterChips
        label="Показать"
        options={STATUS_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
        value={filter}
        href={(f) => href({ filter: f ?? 'held' })}
      />
      {!statuses.length ? (
        <p className="text-muted">
          {filter === 'held' ? 'Все статусы проверены' : 'Статусов нет'}
        </p>
      ) : (
        <StatusQueue
          key={`${filter}:${page}`}
          statuses={statuses}
          canDecide={hasRole(admin.role, 'moderator')}
        />
      )}
      <Pager
        page={page}
        total={total}
        pageSize={STATUS_PAGE_SIZE}
        href={(p) => href({ page: p })}
      />
    </>
  )
}
