import { fmt, type Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { daysAgo, formatDay, formatTime } from '@/i18n/format'

export const ONLINE_MS = 2 * 60 * 1000

// "online" within 2 minutes, else "last seen today at 14:05" / "yesterday at …" / "8 October".
export function lastSeenText(
  iso: string,
  locale: Locale,
  dict: Dictionary['chats'],
  now = new Date(),
): string {
  if (now.getTime() - Date.parse(iso) < ONLINE_MS) return dict.online
  const days = daysAgo(iso, now)
  const time = formatTime(iso, locale)
  if (days <= 0) return fmt(dict.lastSeenToday, { time })
  if (days === 1) return fmt(dict.lastSeenYesterday, { time })
  return fmt(dict.lastSeenOn, { date: formatDay(iso, locale, now) })
}
