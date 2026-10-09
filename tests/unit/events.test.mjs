// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clockOffset,
  countdownTickMs,
  formatCountdown,
} from '../../src/features/events/countdown.ts'
import { fromMalaysia, nightRange, toMalaysiaParts } from '../../src/features/admin/event-time.ts'

const labels = { in: 'in {time}', days: '{n} d', hours: '{n} h', minutes: '{n} min', startingNow: 'starting now' }
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

test('countdown: hours and minutes', () => {
  assert.equal(formatCountdown(3 * HOUR + 12 * MIN, labels), 'in 3 h 12 min')
  assert.equal(formatCountdown(3 * HOUR + 11 * MIN + 1, labels), 'in 3 h 12 min')
  assert.equal(formatCountdown(2 * HOUR, labels), 'in 2 h')
  assert.equal(formatCountdown(HOUR + 59 * MIN + 30_000, labels), 'in 2 h')
})

test('countdown: minutes only, rounded up', () => {
  assert.equal(formatCountdown(12 * MIN, labels), 'in 12 min')
  assert.equal(formatCountdown(11 * MIN + 1, labels), 'in 12 min')
  assert.equal(formatCountdown(MIN, labels), 'in 1 min')
})

test('countdown: days', () => {
  assert.equal(formatCountdown(2 * DAY + 5 * HOUR + 40 * MIN, labels), 'in 2 d 5 h')
  assert.equal(formatCountdown(DAY, labels), 'in 1 d')
})

test('countdown: starting now under a minute and in the past', () => {
  assert.equal(formatCountdown(59_999, labels), 'starting now')
  assert.equal(formatCountdown(0, labels), 'starting now')
  assert.equal(formatCountdown(-5 * MIN, labels), 'starting now')
})

test('countdown: ticks every minute, every second in the last two minutes', () => {
  assert.equal(countdownTickMs(3 * HOUR), MIN)
  assert.equal(countdownTickMs(2 * MIN), MIN)
  assert.equal(countdownTickMs(2 * MIN - 1), 1_000)
})

test('countdown: clock offset from the server stamp', () => {
  const server = '2026-10-10T13:00:00.000Z'
  assert.equal(clockOffset(server, Date.parse(server) + 2_500), 2_500)
  assert.equal(clockOffset(server, Date.parse(server) - 1_000), -1_000)
  assert.equal(clockOffset('not a date', 123), 0)
})

test('event time: Malaysia parts round-trip (UTC+8, no DST)', () => {
  assert.deepEqual(toMalaysiaParts('2026-10-10T13:05:00.000Z'), { date: '2026-10-10', time: '21:05' })
  assert.deepEqual(toMalaysiaParts('2026-10-10T17:30:00.000Z'), { date: '2026-10-11', time: '01:30' })
  assert.equal(fromMalaysia('2026-10-10', '21:05'), '2026-10-10T13:05:00.000Z')
  assert.equal(fromMalaysia('2026-10-10', '9:05'), null)
  assert.equal(fromMalaysia('2026-13-40', '21:05'), null)
})

test('event time: a night that crosses midnight ends the next day', () => {
  assert.deepEqual(nightRange('2026-10-10', '21:00', '23:00'), {
    startsAt: '2026-10-10T13:00:00.000Z',
    endsAt: '2026-10-10T15:00:00.000Z',
  })
  assert.deepEqual(nightRange('2026-10-10', '22:00', '01:00'), {
    startsAt: '2026-10-10T14:00:00.000Z',
    endsAt: '2026-10-10T17:00:00.000Z',
  })
  assert.equal(nightRange('2026-10-10', '22:00', 'x'), null)
})
