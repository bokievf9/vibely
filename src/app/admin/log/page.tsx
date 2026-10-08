import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageSpinner } from '@/components/ui/spinner'
import { formatDate } from '@/features/admin/components/badges'
import { LogExportButton } from '@/features/admin/components/log-export-button'
import { getAdmin } from '@/features/admin/guard'
import { ACTION_LABELS, actionLabel } from '@/features/admin/log-labels'
import {
  getModerationLog,
  getTeamOptions,
  logFilterSchema,
  type LogFilters,
} from '@/features/admin/queries/log'
import { hasRole } from '@/features/admin/roles'

export const metadata: Metadata = { title: 'Журнал' }

export default function LogPage({ searchParams }: PageProps<'/admin/log'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Журнал действий</h1>
      <Suspense fallback={<PageSpinner />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </>
  )
}

const select =
  'bg-surface border-border focus:border-accent h-12 w-full rounded-2xl border px-4 text-base outline-none'

// Query string of the filters, for pagination links.
function href(filters: LogFilters, page: number) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...filters, page })) {
    if (v !== undefined && v !== '' && !(k === 'page' && v === 1)) params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `/admin/log?${qs}` : '/admin/log'
}

async function Log({ searchParams }: Pick<PageProps<'/admin/log'>, 'searchParams'>) {
  const raw = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined
  const filters = logFilterSchema.parse({
    admin: one(raw.admin),
    action: one(raw.action),
    target: one(raw.target),
    from: one(raw.from),
    to: one(raw.to),
    page: one(raw.page),
  })
  const [admin, team, log] = await Promise.all([
    getAdmin(),
    getTeamOptions(),
    getModerationLog(filters),
  ])
  const exportFilters: LogFilters = { ...filters, page: undefined }

  return (
    <>
      <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Фильтры">
        <select
          name="admin"
          defaultValue={filters.admin ?? ''}
          className={select}
          aria-label="Модератор"
        >
          <option value="">Все модераторы</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={filters.action ?? ''}
          className={select}
          aria-label="Действие"
        >
          <option value="">Все действия</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input
          name="target"
          defaultValue={filters.target ?? ''}
          placeholder="ID пользователя или объекта"
          aria-label="Объект"
        />
        <Input name="from" type="date" defaultValue={filters.from ?? ''} aria-label="С даты" />
        <Input name="to" type="date" defaultValue={filters.to ?? ''} aria-label="По дату" />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Показать
          </Button>
          <Link
            href="/admin/log"
            className="bg-surface border-border flex h-12 items-center rounded-2xl border px-4"
          >
            Сброс
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-sm">
          Записей: {log.total} · страница {log.page} из {log.pages}
        </p>
        {hasRole(admin.role, 'admin') && <LogExportButton filters={exportFilters} />}
      </div>

      {!log.entries.length ? (
        <p className="text-muted">Ничего не найдено</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {log.entries.map((e) => (
            <li
              key={e.id}
              className="bg-surface flex flex-col gap-0.5 rounded-2xl px-4 py-3 text-sm"
            >
              <span>
                <span className="font-medium">{e.adminName}</span> · {actionLabel(e.action)}{' '}
                <Link
                  href={href({ ...exportFilters, target: e.targetId }, 1)}
                  className="text-muted hover:underline"
                >
                  ({e.targetType} {e.targetId.slice(0, 8)})
                </Link>
              </span>
              {e.reason && <span className="text-muted break-words">Причина: {e.reason}</span>}
              <time className="text-muted text-xs" dateTime={e.createdAt}>
                {formatDate(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}

      {log.pages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Страницы">
          {log.page > 1 ? (
            <Link href={href(filters, log.page - 1)} className="text-accent hover:underline">
              ← Новее
            </Link>
          ) : (
            <span />
          )}
          {log.page < log.pages && (
            <Link href={href(filters, log.page + 1)} className="text-accent hover:underline">
              Старше →
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
