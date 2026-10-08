import Link from 'next/link'
import { chipClassName } from '@/components/ui/chip'
import { cn } from '@/lib/utils'
import { REPORT_NAV_LINKS } from '../nav-reports'

// Sub-navigation of the reports area: queue, history, flagged users.
export function ReportsTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Жалобы" className="border-border flex gap-1 border-b">
      {[{ href: '/admin/reports', label: 'Очередь' }, ...REPORT_NAV_LINKS].map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            t.href === active ? 'border-accent text-accent' : 'text-muted border-transparent',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

// Chip links for one filter dimension; `null` value = "all".
export function FilterChips<V extends string>({
  label,
  options,
  value,
  href,
}: {
  label: string
  options: { value: V | null; label: string }[]
  value: V | null
  href: (value: V | null) => string
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-muted text-xs">{label}:</span>
      {options.map((o) => (
        <Link
          key={o.value ?? 'all'}
          href={href(o.value)}
          className={chipClassName(o.value === value)}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  )
}

export function Pager({
  page,
  total,
  pageSize,
  href,
}: {
  page: number
  total: number
  pageSize: number
  href: (page: number) => string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav aria-label="Страницы" className="flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={chipClassName(false)}>
          ‹ Назад
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {page} из {pages} · всего {total}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={chipClassName(false)}>
          Вперёд ›
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

// Reads `?page=` (1-based).
export const pageParam = (raw: string | string[] | undefined) => {
  const n = Number(typeof raw === 'string' ? raw : 1)
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1
}
