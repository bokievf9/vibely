import { TIME_ZONE, type Locale } from './config'

const sameDay = (a: Date, b: Date) =>
  a.toLocaleDateString('en', { timeZone: TIME_ZONE }) ===
  b.toLocaleDateString('en', { timeZone: TIME_ZONE })

// "14:05" today, "12 Oct" otherwise. Malaysia time.
export function formatChatTime(iso: string, locale: Locale, now = new Date()) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    ...(sameDay(date, now)
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short' }),
  }).format(date)
}

export function formatTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// Calendar day in Malaysia time, e.g. "2026-10-08": for grouping messages by day.
export function dayKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso))
}

const DAY_MS = 24 * 60 * 60 * 1000

// 0 = today, 1 = yesterday, … in Malaysia time.
export function daysAgo(iso: string, now = new Date()) {
  return Math.round((Date.parse(dayKey(now.toISOString())) - Date.parse(dayKey(iso))) / DAY_MS)
}

// "8 October" this year, "8 October 2025" otherwise. Malaysia time.
export function formatDay(iso: string, locale: Locale, now = new Date()) {
  const sameYear = dayKey(iso).slice(0, 4) === dayKey(now.toISOString()).slice(0, 4)
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(iso))
}
