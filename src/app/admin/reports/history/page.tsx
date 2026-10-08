import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageSpinner } from '@/components/ui/spinner'
import { Badge, formatDate } from '@/features/admin/components/badges'
import {
  FilterChips,
  Pager,
  ReportsTabs,
  pageParam,
} from '@/features/admin/components/reports-tabs'
import { TARGET_LABELS, readableBan } from '@/features/admin/labels'
import { QUEUE_PAGE_SIZE, getReportHistory } from '@/features/admin/queries/reports'
import {
  REASON_CODES,
  REPORT_TARGETS,
  reasonLabel,
  readableDecision,
} from '@/features/admin/report-labels'

export const metadata: Metadata = { title: 'История жалоб' }

const DECISION_CLASS: Record<string, string> = {
  dismiss: 'bg-border text-muted',
  hide: 'bg-amber-500/15 text-amber-400',
  ban: 'bg-red-600 text-white',
  delete_photo: 'bg-red-500/15 text-red-400',
}

export default function ReportHistoryPage({ searchParams }: PageProps<'/admin/reports/history'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">История жалоб</h1>
      <ReportsTabs active="/admin/reports/history" />
      <Suspense fallback={<PageSpinner />}>
        <History searchParams={searchParams} />
      </Suspense>
    </>
  )
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

async function History({
  searchParams,
}: Pick<PageProps<'/admin/reports/history'>, 'searchParams'>) {
  const sp = await searchParams
  const filters = {
    targetType: REPORT_TARGETS.find((t) => t === one(sp.type)) ?? null,
    reason: REASON_CODES.find((r) => r === one(sp.reason)) ?? null,
    page: pageParam(sp.page),
  }
  const { entries, total } = await getReportHistory(filters)

  const href = (next: Partial<Record<'type' | 'reason' | 'page', string | null>>) => {
    const merged = { type: filters.targetType, reason: filters.reason, page: null, ...next }
    const params = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v))
    const q = params.toString()
    return q ? `/admin/reports/history?${q}` : '/admin/reports/history'
  }

  return (
    <>
      <div className="flex flex-col gap-2">
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
            ...REASON_CODES.map((r) => ({ value: r, label: reasonLabel(r) })),
          ]}
          value={filters.reason}
          href={(reason) => href({ reason })}
        />
      </div>
      {!entries.length ? (
        <p className="text-muted">Решений пока нет</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li
              key={`${e.targetType}:${e.targetId}:${e.resolvedAt}`}
              className="bg-surface flex flex-col gap-1 rounded-2xl p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={DECISION_CLASS[e.decision ?? ''] ?? 'bg-border text-muted'}>
                  {readableDecision(e.decision)}
                </Badge>
                <span className="font-medium">
                  {TARGET_LABELS[e.targetType]} · {e.reportCount} жалоб(ы)
                </span>
                {e.subjectId && (
                  <Link href={`/admin/users/${e.subjectId}`} className="hover:underline">
                    {e.subjectName ?? e.subjectId.slice(0, 8)}
                  </Link>
                )}
              </div>
              <p className="text-muted">
                Причины: {e.reasonCodes.map(reasonLabel).join(', ') || '—'}
              </p>
              {e.resolution && (
                <p className="break-words">
                  Решение: {e.decision === 'ban' ? readableBan(e.resolution) : e.resolution}
                </p>
              )}
              <p className="text-muted text-xs">
                {e.resolvedBy} · {formatDate(e.resolvedAt)} (жалоба от{' '}
                {formatDate(e.firstReportedAt)})
              </p>
            </li>
          ))}
        </ul>
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
