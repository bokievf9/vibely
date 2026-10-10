'use client'

import { Bell, Check, Crown, Heart, Minus, Sparkles, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import type { FeatureKey, PlanLevel } from '../access'
import { cellText, type Cell } from '../comparison'
import type { PaidPlan } from '../pricing'
import { usePaywall, usePlanInterest } from './access-provider'

// Small pieces shared by the Plans screen and the upgrade sheet.

export const PLAN_ICONS: Record<PlanLevel, LucideIcon> = { free: Heart, plus: Sparkles, vip: Crown }

// Plus speaks in the accent, VIP in the gold --vip token (the crown everywhere else in the app).
export function PlanMark({ plan, className }: { plan: PlanLevel; className?: string }) {
  const Icon = PLAN_ICONS[plan]
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full',
        plan === 'vip' && 'bg-vip/15 text-vip',
        plan === 'plus' && 'bg-accent/15 text-accent',
        plan === 'free' && 'bg-fill text-foreground',
        className,
      )}
    >
      <Icon className={cn('size-5', plan === 'vip' && 'fill-vip/25')} aria-hidden />
    </span>
  )
}

export function cellLabel(cell: Cell, dict: Dictionary) {
  return cellText(cell, dict.plans.cell)
}

// One comparison cell: a check, a dash or the limit ("100 per day", "Unlimited").
export function CellView({ cell, plan }: { cell: Cell; plan: PlanLevel }) {
  const { dict } = useI18n()
  const label = cellLabel(cell, dict)
  if (cell.kind === 'no')
    return (
      <span className="text-muted/70 flex justify-center">
        <Minus className="size-4" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    )
  if (cell.kind === 'yes')
    return (
      <span className="flex justify-center">
        <Check
          className={cn('size-[1.125rem]', plan === 'vip' ? 'text-vip' : 'text-success')}
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="sr-only">{label}</span>
      </span>
    )
  return (
    <span className="text-foreground block text-center text-[12px] leading-tight font-semibold text-balance">
      {label}
    </span>
  )
}

// A benefit line: the matrix phrase, or "Blind Dates: 10 per day" when the plan caps it.
export function benefitText(key: FeatureKey, cell: Cell, dict: Dictionary) {
  const t = dict.plans
  return cell.kind === 'limit'
    ? `${t.featureNames[key]}: ${cellLabel(cell, dict)}`
    : t.features[key]
}

export function NotifyButton({
  plan,
  known,
  withPlan = false,
  className,
}: {
  plan: PaidPlan
  known?: readonly PaidPlan[]
  // "Notify me when Plus launches" (the sheet) instead of "Notify me when it launches".
  withPlan?: boolean
  className?: string
}) {
  const { dict } = useI18n()
  const t = dict.plans.screen
  const { interested, register, pending } = usePlanInterest(known)
  const done = interested(plan)
  return (
    <Button
      variant="secondary"
      fullWidth
      loading={pending === plan}
      aria-disabled={done || undefined}
      onClick={() => void register(plan)}
      className={cn('h-12 text-[15px]', done && 'text-muted', className)}
    >
      {done ? (
        <>
          <Check className="text-success size-[1.125rem]" strokeWidth={2.5} aria-hidden />
          {t.notified}
        </>
      ) : (
        <>
          <Bell className="size-[1.125rem]" aria-hidden />
          {withPlan ? fmt(t.notifyPlan, { plan: dict.plans.names[plan] }) : t.notify}
        </>
      )}
    </Button>
  )
}

export function PromoLink({ className }: { className?: string }) {
  const { dict } = useI18n()
  const { openPromo } = usePaywall()
  return (
    <button
      type="button"
      onClick={openPromo}
      className={cn(
        'text-accent relative mx-auto text-[15px] font-semibold',
        "before:absolute before:-inset-x-3 before:-inset-y-3 before:content-['']",
        'transition-opacity duration-150 ease-out active:opacity-60',
        className,
      )}
    >
      {dict.plans.screen.promo}
    </button>
  )
}
