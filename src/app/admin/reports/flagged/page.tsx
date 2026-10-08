import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageSpinner } from '@/components/ui/spinner'
import { Badge, BannedBadge, formatDate } from '@/features/admin/components/badges'
import { KeywordEditor } from '@/features/admin/components/keyword-editor'
import { Pager, ReportsTabs, pageParam } from '@/features/admin/components/reports-tabs'
import { FLAGGED_PAGE_SIZE, getFlaggedUsers, getRiskKeywords } from '@/features/admin/queries/flags'
import { FLAG_LABELS, type FlagKind } from '@/features/admin/report-labels'

export const metadata: Metadata = { title: 'Флаги' }

export default function FlaggedPage({ searchParams }: PageProps<'/admin/reports/flagged'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Автоматические флаги</h1>
      <ReportsTabs active="/admin/reports/flagged" />
      <Suspense fallback={<PageSpinner />}>
        <Flagged searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Flagged({
  searchParams,
}: Pick<PageProps<'/admin/reports/flagged'>, 'searchParams'>) {
  const page = pageParam((await searchParams).page)
  const [{ users, total }, keywords] = await Promise.all([getFlaggedUsers(page), getRiskKeywords()])

  return (
    <>
      <p className="text-muted text-sm">
        Сообщения проверяются автоматически при отправке и никогда не блокируются. Здесь только
        счётчики: читать переписку можно лишь по открытой жалобе.
      </p>
      {!users.length ? (
        <p className="text-muted">Пользователей с высоким риском нет</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="bg-surface flex flex-col gap-1.5 rounded-2xl p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-red-500/15 text-red-400">Риск {u.score}</Badge>
                <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                  {u.name}
                </Link>
                <span className="text-muted">@{u.username}</span>
                {u.banned && <BannedBadge />}
                {u.openReports > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-400">
                    Открытых жалоб: {u.openReports}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(u.kinds) as [FlagKind, number][]).map(([kind, n]) => (
                  <Badge key={kind} className="bg-border text-foreground">
                    {FLAG_LABELS[kind] ?? kind}: {n}
                  </Badge>
                ))}
              </div>
              <p className="text-muted text-xs">
                Флагов: {u.flags} в {u.conversations} разговорах · последний{' '}
                {formatDate(u.lastFlagAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        total={total}
        pageSize={FLAGGED_PAGE_SIZE}
        href={(p) => `/admin/reports/flagged?page=${p}`}
      />
      <KeywordEditor keywords={keywords} />
    </>
  )
}
