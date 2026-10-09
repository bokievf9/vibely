import type { Dictionary } from '@/i18n/dictionaries/en'
import { fmt, type Locale } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import type { PromoOutcome } from './schemas'

// Lines for the success sheet: the plan and boost with dates when already running, durations
// when they wait for the selfie check.
export function perkLines(o: PromoOutcome, dict: Dictionary, locale: Locale): string[] {
  const t = dict.promo
  const lines: string[] = []
  if (o.plan && o.days > 0) {
    const plan = dict.plans.names[o.plan]
    lines.push(
      o.planUntil
        ? fmt(t.perkPlanDate, { plan, date: formatDay(o.planUntil, locale) })
        : fmt(t.perkPlanDays, { plan, days: o.days }),
    )
  }
  if (o.boostHours > 0) {
    lines.push(
      o.boostUntil
        ? fmt(t.perkBoostDate, { date: formatDay(o.boostUntil, locale) })
        : fmt(t.perkBoostHours, { hours: o.boostHours }),
    )
  }
  return lines
}
