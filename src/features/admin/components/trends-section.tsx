import Link from 'next/link'
import { chipClassName } from '@/components/ui/chip'
import { getTrends } from '../queries/trends'
import { TREND_METRICS, TrendBars } from './trend-bars'

// /admin: 7 or 30 day trends (?days=30) and per-moderator throughput.
export async function TrendsSection({ days }: { days: 7 | 30 }) {
  const t = await getTrends(days)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Динамика</h2>
        <Link href="/admin" className={chipClassName(days === 7)}>
          7 дней
        </Link>
        <Link href="/admin?days=30" className={chipClassName(days === 30)}>
          30 дней
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TREND_METRICS.map((m) => (
          <TrendBars key={m.key} series={t.series} metric={m} />
        ))}
      </div>
      <p className="text-muted text-sm">
        Медиана времени до решения жалобы:{' '}
        <span className="text-foreground font-semibold">
          {t.medianResolveHours === null ? 'нет данных' : `${t.medianResolveHours} ч`}
        </span>
      </p>

      <h2 className="text-lg font-semibold">Модераторы за {days} дней</h2>
      {!t.moderators.length ? (
        <p className="text-muted text-sm">Действий не было</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-md text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="py-2 font-medium">Модератор</th>
                <th className="py-2 text-right font-medium">Всего</th>
                <th className="py-2 text-right font-medium">Жалобы</th>
                <th className="py-2 text-right font-medium">Селфи</th>
                <th className="py-2 text-right font-medium">Санкции</th>
              </tr>
            </thead>
            <tbody>
              {t.moderators.map((m) => (
                <tr key={m.admin_id} className="border-border border-t">
                  <td className="py-2">
                    <Link href={`/admin/log?admin=${m.admin_id}`} className="hover:underline">
                      {m.name ?? m.admin_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-2 text-right tabular-nums">{m.total}</td>
                  <td className="py-2 text-right tabular-nums">{m.reports}</td>
                  <td className="py-2 text-right tabular-nums">{m.verifications}</td>
                  <td className="py-2 text-right tabular-nums">{m.sanctions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
