import { fmt } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { PaidPlan, PeriodMonths } from './types'

// "Plus, 3 months"
export function planPeriodLabel(dict: Dictionary, plan: PaidPlan, months: PeriodMonths): string {
  return fmt(dict.payments.planPeriod, {
    plan: dict.plans.names[plan],
    period: dict.payments.periods[`m${months}`],
  })
}
