import type { TrendDay } from '../queries/trends'

type Metric = { key: Exclude<keyof TrendDay, 'day'>; label: string; className: string }

export const TREND_METRICS: Metric[] = [
  { key: 'reports_opened', label: 'Жалобы открыты', className: 'bg-amber-400' },
  { key: 'reports_resolved', label: 'Жалобы закрыты', className: 'bg-emerald-400' },
  { key: 'verifications', label: 'Проверено селфи', className: 'bg-sky-400' },
  { key: 'bans', label: 'Баны', className: 'bg-red-500' },
]

const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`

// One small server-rendered bar chart per metric (no chart library). Each bar has a text label for
// screen readers and a tooltip.
export function TrendBars({ series, metric }: { series: TrendDay[]; metric: Metric }) {
  const max = Math.max(1, ...series.map((d) => d[metric.key]))
  const total = series.reduce((sum, d) => sum + d[metric.key], 0)
  return (
    <figure className="bg-surface flex flex-col gap-2 rounded-2xl p-4">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{metric.label}</span>
        <span className="text-lg font-bold tabular-nums">{total}</span>
      </figcaption>
      <ol className="flex h-20 items-end gap-0.5" aria-label={metric.label}>
        {series.map((d) => (
          <li
            key={d.day}
            className="flex h-full flex-1 items-end"
            title={`${dayLabel(d.day)}: ${d[metric.key]}`}
          >
            <span className="sr-only">
              {dayLabel(d.day)}: {d[metric.key]}
            </span>
            <span
              aria-hidden
              className={`w-full rounded-t-sm ${d[metric.key] ? metric.className : 'bg-border'}`}
              style={{ height: `${Math.max(4, (d[metric.key] / max) * 100)}%` }}
            />
          </li>
        ))}
      </ol>
      <div className="text-muted flex justify-between text-xs tabular-nums">
        <span>{series[0] && dayLabel(series[0].day)}</span>
        <span>{series.at(-1) && dayLabel(series.at(-1)!.day)}</span>
      </div>
    </figure>
  )
}
