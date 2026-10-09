'use client'

import { Check, Crown, Sparkles } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { featuresOf, type FeatureKey } from '../access'
import type { UpgradeReason } from '../errors'
import { useAccess } from './access-provider'

type Props = {
  feature: FeatureKey
  reason?: UpgradeReason
  // One line with an icon, in place of a gated control (feed composer, comment box).
  compact?: boolean
  // Overrides the default line of a compact card.
  text?: string
  className?: string
}

// "Available in Plus / VIP" with what it unlocks. No prices: plans come from promo codes and
// rewards for now. Used inline (compact) and in the upgrade sheet.
export function UpgradeCard({
  feature,
  reason = 'feature',
  compact = false,
  text,
  className,
}: Props) {
  const { dict } = useI18n()
  const t = dict.plans
  const { access, upgradePlan } = useAccess()
  const plan = upgradePlan(feature)
  const planName = t.names[plan]
  const Icon = plan === 'vip' ? Crown : Sparkles
  const f = access.features[feature]

  const title =
    reason === 'limit'
      ? t.limitTitle
      : reason === 'partner'
        ? t.partnerTitle
        : fmt(t.availableIn, { plan: planName })
  const body =
    reason === 'partner'
      ? t.partnerBody
      : reason === 'limit'
        ? f?.limit !== null && f?.limit !== undefined && f.period
          ? fmt(t.limitBody, { limit: f.limit, period: t.periods[f.period], plan: planName })
          : fmt(t.limitBodyShort, { plan: planName })
        : t.features[feature]

  const icon = (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full',
        plan === 'vip' ? 'bg-vip/15 text-vip' : 'bg-accent/15 text-accent',
      )}
    >
      <Icon className={cn('size-5', plan === 'vip' && 'fill-vip/25')} aria-hidden />
    </span>
  )

  if (compact) {
    return (
      <div className={cn('card flex items-center gap-3 px-4 py-3', className)}>
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-callout font-semibold">{title}</p>
          <p className="text-muted text-footnote text-pretty">{text ?? body}</p>
        </div>
      </div>
    )
  }

  const more = featuresOf(access, plan)
    .filter((k) => k !== feature)
    .slice(0, 5)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-headline">{title}</p>
          <p className="text-muted text-callout text-pretty">{body}</p>
        </div>
      </div>
      {reason !== 'partner' && more.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-footnote text-muted px-1 font-medium">
            {fmt(t.unlocks, { plan: planName })}
          </p>
          <ul className="card divide-border flex flex-col divide-y">
            {more.map((k) => (
              <li key={k} className="flex items-center gap-3 px-4 py-2.5">
                <Check className="text-success size-4.5 shrink-0" aria-hidden />
                <span className="text-callout min-w-0">{t.features[k]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {reason !== 'partner' && (
        <p className="text-muted text-footnote px-1 text-pretty">
          {t.howToGet}{' '}
          <LocaleLink href="/settings" className="text-accent font-medium">
            {t.enterCode}
          </LocaleLink>
        </p>
      )}
    </div>
  )
}
