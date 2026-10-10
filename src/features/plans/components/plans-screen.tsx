'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import { useI18n } from '@/i18n/client'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import type { PlanLevel } from '../access'
import {
  comparisonGroups,
  planBenefits,
  planIncludes,
  type Catalog,
  type Cell,
} from '../comparison'
import {
  BILLING_PERIODS,
  formatPrice,
  monthlyEquivalent,
  PAYMENTS_ENABLED,
  planPrice,
  type BillingPeriod,
  type PaidPlan,
} from '../pricing'
import { benefitText, CellView, NotifyButton, PlanMark, PromoLink } from './plan-ui'

type Props = {
  plan: PlanLevel
  planUntil: string | null
  isStaff: boolean
  catalog: Catalog | null
  interest: PaidPlan[]
}

const PILL_SPRING = { type: 'spring', duration: 0.35, bounce: 0.15 } as const

// /plans: Free, Plus and VIP side by side in one column, the price area (no prices yet), and the
// comparison generated from the live matrix. Nothing here can take a payment.
export function PlansScreen({ plan, planUntil, isStaff, catalog, interest }: Props) {
  const { dict } = useI18n()
  const t = dict.plans.screen
  const [period, setPeriod] = useState<BillingPeriod>('month')

  return (
    <div className="flex flex-col gap-6 px-4 pb-10">
      <p className="text-muted text-callout -mt-1 px-1 text-pretty">{t.intro}</p>
      {isStaff && <p className="card text-callout px-4 py-3 text-pretty">{t.staff}</p>}

      <BillingToggle value={period} onChange={setPeriod} />

      <div className="flex flex-col gap-4">
        {(['plus', 'vip'] as const).map((p) => (
          <PaidCard
            key={p}
            plan={p}
            period={period}
            current={!isStaff && plan === p}
            planUntil={plan === p ? planUntil : null}
            catalog={catalog}
            interest={interest}
          />
        ))}
        <FreeCard current={!isStaff && plan === 'free'} catalog={catalog} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <PromoLink className="py-1" />
        <p className="text-muted text-footnote max-w-[34ch] text-center text-pretty">{t.legal}</p>
      </div>

      {catalog && <Comparison catalog={catalog} current={isStaff ? null : plan} />}
    </div>
  )
}

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod
  onChange: (p: BillingPeriod) => void
}) {
  const { dict } = useI18n()
  const t = dict.plans.screen
  const reduce = useReducedMotion()
  return (
    <div
      role="radiogroup"
      aria-label={t.billing}
      className="bg-surface border-border grid grid-cols-3 gap-1 rounded-full border p-1"
    >
      {BILLING_PERIODS.map((p) => {
        const selected = value === p
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p)}
            className={cn(
              'relative h-10 min-w-0 rounded-full px-2 text-[14px] font-semibold transition-colors duration-150',
              selected ? 'text-foreground' : 'text-muted active:text-foreground',
            )}
          >
            {selected && (
              <motion.span
                layoutId="billing-pill"
                transition={reduce ? { duration: 0 } : PILL_SPRING}
                className="bg-fill absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                aria-hidden
              />
            )}
            <span className="relative block truncate">{t.periods[p]}</span>
          </button>
        )
      })}
    </div>
  )
}

function CurrentPill({ planUntil }: { planUntil: string | null }) {
  const { dict, locale } = useI18n()
  const t = dict.plans.screen
  return (
    <span className="bg-success/15 text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold">
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
      {planUntil
        ? `${t.current}. ${fmt(t.currentUntil, { date: formatDay(planUntil, locale) })}`
        : t.current}
    </span>
  )
}

function Price({ plan, period }: { plan: PaidPlan; period: BillingPeriod }) {
  const { dict } = useI18n()
  const t = dict.plans.screen
  const price = planPrice(plan, period)
  if (!price) {
    return <p className="text-title2 text-muted tracking-tight">{t.priceSoon}</p>
  }
  const monthly = monthlyEquivalent(price, period)
  return (
    <div className="flex flex-col">
      <p className="text-title2 tabular-nums">
        {fmt(t.perPeriod[period], { price: formatPrice(price) })}
      </p>
      {monthly && (
        <p className="text-muted text-footnote tabular-nums">
          {fmt(t.perMonth, { price: formatPrice(monthly) })}
        </p>
      )}
    </div>
  )
}

function BenefitList({
  items,
  plan,
  dict,
}: {
  items: { key: Parameters<typeof benefitText>[0]; cell: Cell }[]
  plan: PlanLevel
  dict: Dictionary
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((b) => (
        <li key={b.key} className="flex items-start gap-2.5">
          <Check
            className={cn(
              'mt-0.5 size-[1.125rem] shrink-0',
              plan === 'vip' ? 'text-vip' : plan === 'plus' ? 'text-accent' : 'text-success',
            )}
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="text-callout min-w-0 text-pretty">
            {benefitText(b.key, b.cell, dict)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function PaidCard({
  plan,
  period,
  current,
  planUntil,
  catalog,
  interest,
}: {
  plan: PaidPlan
  period: BillingPeriod
  current: boolean
  planUntil: string | null
  catalog: Catalog | null
  interest: PaidPlan[]
}) {
  const { dict } = useI18n()
  const t = dict.plans
  const benefits = catalog ? planBenefits(catalog, plan) : []
  const vip = plan === 'vip'

  return (
    <section
      aria-labelledby={`plan-${plan}`}
      className={cn(
        'relative flex flex-col gap-4 overflow-hidden rounded-[var(--radius-card)] border p-5',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_16px_32px_-24px_rgb(0_0_0/0.9)]',
        vip
          ? 'border-vip/35 bg-surface bg-[linear-gradient(160deg,rgb(217_180_90/0.12),rgb(217_180_90/0.02)_45%,transparent)]'
          : 'border-accent/35 bg-surface',
        current && 'ring-success/60 ring-2',
      )}
    >
      <div className="flex items-start gap-3">
        <PlanMark plan={plan} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={`plan-${plan}`} className="text-title2">
              {t.names[plan]}
            </h2>
            {plan === 'plus' && !current && (
              <span className="bg-accent/15 text-accent rounded-full px-2.5 py-1 text-[12px] font-semibold">
                {t.screen.popular}
              </span>
            )}
            {current && <CurrentPill planUntil={planUntil} />}
          </div>
          <p className="text-muted text-callout text-pretty">{t.screen.taglines[plan]}</p>
        </div>
      </div>

      <Price plan={plan} period={period} />

      {benefits.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {vip && (
            <p className="text-footnote text-muted font-medium">
              {fmt(t.screen.everythingIn, { plan: t.names.plus })}
            </p>
          )}
          <BenefitList items={benefits} plan={plan} dict={dict} />
        </div>
      )}

      {!current && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={!PAYMENTS_ENABLED}
            className={cn(
              'bg-fill text-muted flex h-[3.25rem] w-full items-center justify-center rounded-2xl',
              'text-[1.0625rem] font-semibold tracking-[-0.012em] select-none disabled:cursor-not-allowed',
            )}
          >
            {t.screen.comingSoon}
          </button>
          <NotifyButton plan={plan} known={interest} />
        </div>
      )}
    </section>
  )
}

function FreeCard({ current, catalog }: { current: boolean; catalog: Catalog | null }) {
  const { dict } = useI18n()
  const t = dict.plans
  const items = catalog ? planIncludes(catalog, 'free') : []
  return (
    <section
      aria-labelledby="plan-free"
      className={cn('card flex flex-col gap-4 p-5', current && 'ring-success/60 ring-2')}
    >
      <div className="flex items-start gap-3">
        <PlanMark plan="free" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id="plan-free" className="text-title2">
              {t.names.free}
            </h2>
            {current && <CurrentPill planUntil={null} />}
          </div>
          <p className="text-muted text-callout text-pretty">{t.screen.taglines.free}</p>
        </div>
      </div>
      <p className="text-title2">{t.screen.freePrice}</p>
      {items.length > 0 && <BenefitList items={items} plan="free" dict={dict} />}
    </section>
  )
}

function Comparison({ catalog, current }: { catalog: Catalog; current: PlanLevel | null }) {
  const { dict } = useI18n()
  const t = dict.plans
  const groups = comparisonGroups(catalog)
  const levels = ['free', 'plus', 'vip'] as const
  const tint = (p: PlanLevel) => (p === current ? 'bg-white/[0.035]' : undefined)

  return (
    <section aria-labelledby="plans-compare" className="flex flex-col gap-3">
      <h2 id="plans-compare" className="text-title2 px-1">
        {t.screen.compare}
      </h2>
      <div className="card overflow-clip">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col />
            <col className="w-[4.5rem]" />
            <col className="w-[4.5rem]" />
            <col className="w-[4.5rem]" />
          </colgroup>
          <thead className="bg-surface-raised/95 sticky top-[var(--header-h)] z-10 backdrop-blur">
            <tr>
              <th scope="col" className="sr-only">
                {t.screen.includes}
              </th>
              {levels.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className={cn(
                    'border-border border-b px-1 py-3 text-center text-[13px] font-semibold',
                    p === 'vip' ? 'text-vip' : p === 'plus' ? 'text-accent' : 'text-foreground',
                    tint(p),
                  )}
                >
                  {t.names[p]}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.group}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="text-footnote text-muted px-4 pt-5 pb-1.5 font-semibold tracking-[0.01em]"
                >
                  {t.groups[g.group]}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.key}>
                  <th
                    scope="row"
                    className="text-callout py-2.5 pr-2 pl-4 align-middle font-normal"
                  >
                    <span className="block text-pretty">{t.featureNames[r.key]}</span>
                    {r.key === 'calls' && (
                      <span className="text-muted text-footnote block text-pretty">
                        {t.callsNote}
                      </span>
                    )}
                  </th>
                  {levels.map((p) => (
                    <td key={p} className={cn('px-1 py-2.5 align-middle', tint(p))}>
                      <CellView cell={r.cells[p]} plan={p} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}
