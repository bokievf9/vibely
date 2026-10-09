// Countdown text for a Blind Dating Night. Pure functions (unit tested): no dates are read here,
// the caller passes "now" so the server clock offset can be applied.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type CountdownLabels = {
  in: string // 'in {time}'
  days: string // '{n} d'
  hours: string // '{n} h'
  minutes: string // '{n} min'
  startingNow: string
}

const put = (template: string, n: number) => template.replace('{n}', String(n))

// "in 2 d 5 h" (a day or more), "in 3 h 12 min" (an hour or more), "in 12 min", or
// "starting now" under a minute. Minutes are rounded up so the text never reads 0.
export function formatCountdown(msLeft: number, labels: CountdownLabels): string {
  const left = Math.max(0, msLeft)
  if (left < MINUTE) return labels.startingNow
  let text: string
  if (left >= DAY) {
    const days = Math.floor(left / DAY)
    const hours = Math.floor((left % DAY) / HOUR)
    text = hours ? `${put(labels.days, days)} ${put(labels.hours, hours)}` : put(labels.days, days)
  } else {
    const totalMinutes = Math.ceil(left / MINUTE)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours && minutes) text = `${put(labels.hours, hours)} ${put(labels.minutes, minutes)}`
    else if (hours) text = put(labels.hours, hours)
    else text = put(labels.minutes, minutes)
  }
  return labels.in.replace('{time}', text)
}

// How long until the countdown text changes: once a minute while hours or minutes are shown,
// every second in the last two minutes (so "starting now" flips over on time).
export function countdownTickMs(msLeft: number): number {
  return msLeft < 2 * MINUTE ? 1_000 : MINUTE
}

// Milliseconds the client clock is ahead of the server (negative: behind), from the time the
// server stamped on the answer and the time the client received it.
export function clockOffset(serverNowIso: string, clientNowMs: number): number {
  const server = Date.parse(serverNowIso)
  return Number.isFinite(server) ? clientNowMs - server : 0
}
