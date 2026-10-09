// Malaysia time (Asia/Kuala_Lumpur, UTC+8, no daylight saving) for the events form: the admin
// types a local date and times, the database stores timestamptz. Pure functions, unit tested.

const OFFSET = '+08:00'

const fields = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// ISO instant -> { date: 'YYYY-MM-DD', time: 'HH:MM' } in Malaysia time.
export function toMalaysiaParts(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    fields.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

// Malaysia date + time -> ISO instant. Returns null for an unparsable input.
export function fromMalaysia(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const ms = Date.parse(`${date}T${time}:00${OFFSET}`)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

// Start and end of a night from one date and two times. An end at or before the start means the
// night crosses midnight (22:00 to 01:00), so it lands on the next day.
export function nightRange(
  date: string,
  startTime: string,
  endTime: string,
): { startsAt: string; endsAt: string } | null {
  const startsAt = fromMalaysia(date, startTime)
  const sameDay = fromMalaysia(date, endTime)
  if (!startsAt || !sameDay) return null
  const endsAt =
    Date.parse(sameDay) > Date.parse(startsAt)
      ? sameDay
      : new Date(Date.parse(sameDay) + 24 * 60 * 60 * 1000).toISOString()
  return { startsAt, endsAt }
}

// "пт, 10 окт., 21:00" in Malaysia time (admin panel is Russian).
export function formatMalaysia(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(new Date(iso))
}
