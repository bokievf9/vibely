import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageSpinner } from '@/components/ui/spinner'
import { WaitlistManager } from '@/features/admin/components/waitlist-manager'
import { getAdmin } from '@/features/admin/guard'
import {
  WAITLIST_PAGE_SIZE,
  WAITLIST_STATUSES,
  getWaitlistPage,
  getWaitlistStats,
  waitlistFilterSchema,
  type WaitlistStatus,
} from '@/features/admin/queries/waitlist'
import { hasRole } from '@/features/admin/roles'
import { landingRu } from '@/i18n/dictionaries/landing/ru'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Лист ожидания' }

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  pending: 'Ждут приглашения',
  invited: 'Приглашены',
  all: 'Все',
}

// Every panel member (viewer and up) sees masked numbers and counts. The CSV with full numbers
// and "mark invited" are for admin and owner; both are logged in the journal.
export default function WaitlistPage({ searchParams }: PageProps<'/admin/waitlist'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Лист ожидания</h1>
      <p className="text-muted -mt-2 text-sm">
        Номера с лендинга, пока регистрация по SMS закрыта. Номера скрыты; полные номера есть только
        в CSV (администратор и владелец, выгрузка пишется в журнал). Номер удаляется через 90 дней
        после приглашения.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <Waitlist searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Waitlist({ searchParams }: Pick<PageProps<'/admin/waitlist'>, 'searchParams'>) {
  const { status, page } = waitlistFilterSchema.parse(await searchParams)
  const admin = await getAdmin()
  const [stats, list] = await Promise.all([getWaitlistStats(), getWaitlistPage(status, page)])
  if (!stats || !list) {
    return (
      <p className="bg-surface rounded-2xl px-4 py-3 text-sm text-amber-400">
        Раздел недоступен: миграция 20261009000300_waitlist ещё не применена к базе.
      </p>
    )
  }
  const pages = Math.max(1, Math.ceil(list.total / WAITLIST_PAGE_SIZE))
  const cities = Object.entries(stats.byCity).sort((a, b) => b[1] - a[1])
  const href = (s: WaitlistStatus, p = 1) =>
    `/admin/waitlist?status=${s}${p > 1 ? `&page=${p}` : ''}`
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Всего', stats.total],
          ['Ждут', stats.pending],
          ['Приглашены', stats.invited],
          ['За 24 часа', stats.last24h],
          ['За 7 дней', stats.last7d],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface rounded-2xl px-4 py-3">
            <dt className="text-muted text-xs">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {cities.length > 0 && (
        <p className="text-muted text-sm">
          По городам:{' '}
          {cities
            .map(
              ([c, n]) =>
                `${c === 'none' ? 'не указан' : (landingRu.waitlist.cities[c as keyof typeof landingRu.waitlist.cities] ?? c)} ${n}`,
            )
            .join(', ')}
          . По языкам:{' '}
          {Object.entries(stats.byLocale)
            .map(([l, n]) => `${l.toUpperCase()} ${n}`)
            .join(', ')}
          .
        </p>
      )}
      <nav aria-label="Фильтр" className="flex flex-wrap gap-2">
        {(
          [
            'pending',
            'invited',
            'all',
          ] as const satisfies readonly (typeof WAITLIST_STATUSES)[number][]
        ).map((s) => (
          <Link
            key={s}
            href={href(s)}
            aria-current={s === status ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center rounded-full px-4 text-sm font-medium',
              s === status ? 'bg-accent text-accent-foreground' : 'bg-surface',
            )}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      <WaitlistManager
        entries={list.entries}
        status={status}
        canManage={hasRole(admin.role, 'admin')}
        cityLabels={landingRu.waitlist.cities}
      />
      {pages > 1 && (
        <nav aria-label="Страницы" className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href(status, page - 1)} className="bg-surface rounded-full px-4 py-2">
              Назад
            </Link>
          )}
          <span className="text-muted">
            Страница {page} из {pages}
          </span>
          {page < pages && (
            <Link href={href(status, page + 1)} className="bg-surface rounded-full px-4 py-2">
              Дальше
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
