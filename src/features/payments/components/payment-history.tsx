import Link from 'next/link'
import { ChevronRight, Receipt } from 'lucide-react'
import { groupedRowClassName } from '@/components/ui/grouped'
import { SettingsSection } from '@/features/settings/components/settings-section'
import { formatSen } from '@/features/plans/pricing'
import { localePath } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import { getDictionary, getLocale } from '@/i18n/server'
import { cn } from '@/lib/utils'
import { planPeriodLabel } from '../labels'
import { getCheckoutMode, getMyPayments, type MyPayment } from '../queries'

// Settings: "Payments > Payment history". Shown once the viewer has an order or can check out;
// hidden before the payments migration (my_payments missing).
export async function PaymentHistorySettings() {
  const [payments, mode, dict, locale] = await Promise.all([
    getMyPayments(),
    getCheckoutMode(),
    getDictionary(),
    getLocale(),
  ])
  if (payments === null || (payments.length === 0 && mode.kind === 'off')) return null
  const t = dict.payments.history
  return (
    <SettingsSection title={t.section}>
      <Link href={localePath(locale, '/settings/payments')} className={groupedRowClassName}>
        <span className="icon-tile bg-accent/15 text-accent">
          <Receipt className="size-[1.125rem]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{t.title}</span>
          <span className="text-muted text-footnote font-normal">{t.hint}</span>
        </span>
        <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
      </Link>
    </SettingsSection>
  )
}

const statusTone: Record<MyPayment['status'], string> = {
  paid: 'bg-success/15 text-success',
  pending: 'bg-fill text-muted',
  failed: 'bg-danger/15 text-danger',
  refunded: 'bg-fill text-muted',
  cancelled: 'bg-fill text-muted',
  expired: 'bg-fill text-muted',
}

// /settings/payments: date, plan and period, amount in RM, status. Null before the migration.
export async function PaymentHistoryList() {
  const [payments, dict, locale] = await Promise.all([
    getMyPayments(),
    getDictionary(),
    getLocale(),
  ])
  const t = dict.payments
  if (!payments?.length) {
    return <p className="text-muted text-callout px-5 py-6 text-center">{t.history.empty}</p>
  }
  return (
    <ul className="card divide-border mx-4 flex flex-col divide-y overflow-hidden">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[16px] font-medium">
              {planPeriodLabel(dict, p.plan, p.periodMonths)}
            </span>
            <span className="text-muted text-footnote">
              {formatDay(p.paidAt ?? p.createdAt, locale)}
              {p.provider === 'test' && ` · ${t.history.test}`}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-semibold tabular-nums">{formatSen(p.amountSen)}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[12px] font-semibold',
                statusTone[p.status],
              )}
            >
              {t.statuses[p.status]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
