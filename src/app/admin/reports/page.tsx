import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { TARGET_LABELS } from '@/features/admin/labels'
import { REASON_CODES, REPORT_TARGETS, reasonLabel } from '@/features/admin/report-labels'
import { ReportQueue } from '@/features/admin/components/report-queue'
import { getAdmin } from '@/features/admin/guard'
import {
  FilterChips,
  Pager,
  ReportsTabs,
  pageParam,
} from '@/features/admin/components/reports-tabs'
import {
  QUEUE_PAGE_SIZE,
  getReportQueue,
  type QueueFilters,
} from '@/features/admin/queries/reports'

export const metadata: Metadata = { title: 'Жалобы' }

const STATUSES = ['open', 'in_review', 'mine'] as const
const STATUS_OPTIONS = [
  { value: null, label: 'Все открытые' },
  { value: 'open', label: 'Новые' },
  { value: 'in_review', label: 'На проверке' },
  { value: 'mine', label: 'Мои' },
] as const

export default function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Жалобы</h1>
      <ReportsTabs active="/admin/reports" />
      <Suspense fallback={<PageSpinner />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  )
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

async function Queue({ searchParams }: Pick<PageProps<'/admin/reports'>, 'searchParams'>) {
  const sp = await searchParams
  const filters: QueueFilters = {
    status: STATUSES.find((s) => s === one(sp.status)) ?? null,
    targetType: REPORT_TARGETS.find((t) => t === one(sp.type)) ?? null,
    reason: REASON_CODES.find((r) => r === one(sp.reason)) ?? null,
    page: pageParam(sp.page),
  }
  const [{ cases, total }, admin] = await Promise.all([getReportQueue(filters), getAdmin()])

  const href = (next: Partial<Record<'status' | 'type' | 'reason' | 'page', string | null>>) => {
    const merged = {
      status: filters.status,
      type: filters.targetType,
      reason: filters.reason,
      page: null as string | null,
      ...next,
    }
    const params = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v))
    const q = params.toString()
    return q ? `/admin/reports?${q}` : '/admin/reports'
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <FilterChips
          label="Статус"
          options={[...STATUS_OPTIONS]}
          value={filters.status}
          href={(status) => href({ status })}
        />
        <FilterChips
          label="Тип"
          options={[
            { value: null, label: 'Все' },
            ...REPORT_TARGETS.map((t) => ({ value: t, label: TARGET_LABELS[t] })),
          ]}
          value={filters.targetType}
          href={(type) => href({ type })}
        />
        <FilterChips
          label="Причина"
          options={[
            { value: null, label: 'Все' },
            // Underage first, as a quick filter: those cases also sort first in the queue.
            { value: 'underage', label: '🔞 Младше 18' },
            ...REASON_CODES.filter((r) => r !== 'underage').map((r) => ({
              value: r,
              label: reasonLabel(r),
            })),
          ]}
          value={filters.reason}
          href={(reason) => href({ reason })}
        />
      </div>
      {!cases.length ? (
        <p className="text-muted">Открытых жалоб нет 🎉</p>
      ) : (
        <ReportQueue cases={cases} role={admin.role} />
      )}
      <Pager
        page={filters.page}
        total={total}
        pageSize={QUEUE_PAGE_SIZE}
        href={(page) => href({ page: String(page) })}
      />
    </>
  )
}
