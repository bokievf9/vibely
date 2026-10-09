import type { Dictionary } from '@/i18n/dictionaries/en'
import { fmt, type Locale } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import type { PromoOutcome } from './schemas'

// Lines for the success sheet: dates when the perks are already running, durations when they
// wait for the selfie check.
export function perkLines(o: PromoOutcome, t: Dictionary['promo'], locale: Locale): string[] {
  const lines: string[] = []
  if (o.vipDays > 0) {
    lines.push(
      o.vipUntil
        ? fmt(t.perkVipDate, { date: formatDay(o.vipUntil, locale) })
        : fmt(t.perkVipDays, { days: o.vipDays }),
    )
  }
  if (o.boostHours > 0) {
    lines.push(
      o.boostUntil
        ? fmt(t.perkBoostDate, { date: formatDay(o.boostUntil, locale) })
        : fmt(t.perkBoostHours, { hours: o.boostHours }),
    )
  }
  if (o.seeLikes) lines.push(t.perkSeeLikes)
  if (o.queuePriority) lines.push(t.perkQueue)
  return lines
}
