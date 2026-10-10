'use client'

import { Check, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { featuresOf, type FeatureKey } from '../access'
import { planBenefits, plusVsVip } from '../comparison'
import type { UpgradeReason } from '../errors'
import { useAccess, usePaywall } from './access-provider'
import { FEATURE_ICONS } from './feature-icons'
import { benefitText, CellView, NotifyButton, PlanMark, PromoLink } from './plan-ui'

type Props = {
  feature: FeatureKey
  reason?: UpgradeReason
  // One tappable line with an icon, in place of a gated control (feed composer, comment box).
  // Tapping it opens the upgrade sheet.
  compact?: boolean
  // Overrides the default line of a compact card.
  text?: string
  className?: string
}

// "Available in Plus / VIP". Compact: a row that opens the upgrade sheet. Full (the sheet body):
// the feature that was tapped, what the plan gives, Plus next to VIP, "Notify me" and the promo
// code. No prices yet: payments are not connected.
export function UpgradeCard({
  feature,
  reason = 'feature',
  compact = false,
  text,
  className,
}: Props) {
  const { dict } = useI18n()
  const t = dict.plans
  const { access, upgradePlan, showUpgrade } = useAccess()
  const plan = upgradePlan(feature)
  const planName = t.names[plan]
  const f = access.features[feature]

  const title = reason === 'limit' ? t.limitTitle : fmt(t.availableIn, { plan: planName })
  const body =
    reason === 'limit'
      ? f?.limit !== null && f?.limit !== undefined && f.period
        ? fmt(t.limitBody, { limit: f.limit, period: t.periods[f.period], plan: planName })
        : fmt(t.limitBodyShort, { plan: planName })
      : t.features[feature]

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => showUpgrade({ feature, reason })}
        className={cn(
          'card flex w-full items-center gap-3 px-4 py-3 text-left',
          'transition-[scale,background-color] duration-150 ease-out active:scale-[0.98]',
          className,
        )}
      >
        <PlanMark plan={plan} />
        <span className="min-w-0 flex-1">
          <span className="text-callout block font-semibold">{title}</span>
          <span className="text-muted text-footnote block text-pretty">{text ?? body}</span>
        </span>
        <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
      </button>
    )
  }

  return <UpgradeDetails feature={feature} reason={reason} className={className} />
}

function UpgradeDetails({
  feature,
  reason,
  className,
}: {
  feature: FeatureKey
  reason: UpgradeReason
  className?: string
}) {
  const { dict } = useI18n()
  const t = dict.plans
  const { access, upgradePlan } = useAccess()
  const { paywall } = usePaywall()
  const plan = upgradePlan(feature)
  const planName = t.names[plan]
  const f = access.features[feature]
  const Icon = FEATURE_ICONS[feature]

  const line =
    reason === 'limit'
      ? f?.limit !== null && f?.limit !== undefined && f.period
        ? fmt(t.limitBody, { limit: f.limit, period: t.periods[f.period], plan: planName })
        : fmt(t.limitBodyShort, { plan: planName })
      : feature === 'calls'
        ? `${fmt(t.availableIn, { plan: planName })}. ${t.callsNote}`
        : fmt(t.availableIn, { plan: planName })

  const catalog = paywall?.catalog
  const benefits = catalog
    ? planBenefits(catalog, plan).map((b) => ({ key: b.key, text: benefitText(b.key, b.cell, dict) }))
    : paywall
      ? featuresOf(access, plan)
          .slice(0, 4)
          .map((k) => ({ key: k, text: t.features[k] }))
      : null
  const rows = catalog ? plusVsVip(catalog, feature) : []

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-2xl',
            plan === 'vip' ? 'bg-vip/15 text-vip' : 'bg-accent/15 text-accent',
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-headline">{t.featureNames[feature]}</p>
          <p className="text-muted text-callout text-pretty">{line}</p>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-footnote text-muted px-1 font-medium">
          {fmt(t.sheet.gets, { plan: planName })}
        </h3>
        {benefits ? (
          <ul className="card flex flex-col gap-0.5 px-4 py-2">
            {benefits.map((b) => (
              <li key={b.key} className="flex items-center gap-3 py-1.5">
                <Check
                  className={cn('size-[1.125rem] shrink-0', plan === 'vip' ? 'text-vip' : 'text-success')}
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span className="text-callout min-w-0 text-pretty">{b.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Skeleton className="h-[9.5rem] rounded-[var(--radius-card)]" />
        )}
      </section>

      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-footnote text-muted px-1 font-medium">{t.sheet.compare}</h3>
          <table className="card w-full border-separate border-spacing-0 overflow-hidden text-left">
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  {t.screen.compare}
                </th>
                {(['plus', 'vip'] as const).map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className={cn(
                      'w-[5.5rem] px-1 pt-3 pb-1.5 text-center text-[13px] font-semibold',
                      p === 'vip' ? 'text-vip' : 'text-accent',
                    )}
                  >
                    {t.names[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th
                    scope="row"
                    className={cn(
                      'text-callout py-2.5 pr-2 pl-4 font-normal',
                      r.key === feature && 'font-semibold',
                    )}
                  >
                    {t.featureNames[r.key]}
                  </th>
                  <td className="px-1 py-2.5">
                    <CellView cell={r.cells.plus} plan="plus" />
                  </td>
                  <td className="px-1 py-2.5 pr-3">
                    <CellView cell={r.cells.vip} plan="vip" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <NotifyButton plan={plan} withPlan />
        <PromoLink className="py-1" />
        <p className="text-muted text-footnote text-center text-pretty">{t.screen.legal}</p>
      </div>
    </div>
  )
}
