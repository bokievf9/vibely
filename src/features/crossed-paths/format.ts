// "Crossed paths 2 times today near Bangsar". Day granularity only, never a time.
// No path aliases here: tests/unit imports this file directly.

type Forms = { one: string; few: string; many: string; other: string }
export type CrossedLineText = {
  today: Forms
  yesterday: Forms
  todayShort: Forms
  yesterdayShort: Forms
  near: string
  nearby: string
}

export function crossedLine(
  t: CrossedLineText,
  locale: string,
  person: { crossings: number; today: boolean; area: string | null; city: string | null },
  // Under a "You crossed paths" title: "2 times today near Bangsar".
  short = false,
) {
  const count = Math.max(1, person.crossings)
  const forms = short
    ? person.today
      ? t.todayShort
      : t.yesterdayShort
    : person.today
      ? t.today
      : t.yesterday
  const category = new Intl.PluralRules(locale).select(count)
  const template = count === 1 ? forms.one : (forms[category as keyof Forms] ?? forms.other)
  const area = person.area ?? person.city
  const place = area ? t.near.replace('{area}', area) : t.nearby
  return template.replace('{count}', String(count)).replace('{place}', place)
}

export const PING_INTERVAL_MS = 10 * 60 * 1000

// Foreground pings: at most one attempt every 10 minutes, across reloads and tabs.
export function pingDue(lastAttempt: number | null, now: number) {
  if (lastAttempt === null || !Number.isFinite(lastAttempt) || lastAttempt > now) return true
  return now - lastAttempt >= PING_INTERVAL_MS
}
