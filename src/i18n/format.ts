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
