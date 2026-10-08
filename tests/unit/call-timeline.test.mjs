// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCallDuration, toCallEntry, withCalls } from '../../src/features/calls/timeline.ts'

const row = (extra = {}) => ({
  id: 'c1',
  kind: 'video',
  status: 'ended',
  caller_id: 'me',
  started_at: '2026-10-08T10:00:00Z',
  answered_at: '2026-10-08T10:00:05Z',
  ended_at: '2026-10-08T10:05:17Z',
  ...extra,
})

test('entry: duration, direction', () => {
  const e = toCallEntry(row(), 'me')
  assert.equal(e.durationSec, 312)
  assert.equal(e.outgoing, true)
  assert.equal(toCallEntry(row(), 'other').outgoing, false)
  assert.equal(toCallEntry(row({ answered_at: null, status: 'missed' }), 'me').durationSec, null)
})

test('entry: stale ringing shows as missed', () => {
  const now = Date.parse('2026-10-08T10:00:31Z')
  const ringing = row({ status: 'ringing', answered_at: null, ended_at: null })
  assert.equal(toCallEntry(ringing, 'me', now).status, 'missed')
  assert.equal(toCallEntry(ringing, 'me', Date.parse('2026-10-08T10:00:10Z')).status, 'ringing')
})

test('duration format', () => {
  assert.equal(formatCallDuration(312), '5:12')
  assert.equal(formatCallDuration(7), '0:07')
  assert.equal(formatCallDuration(3723), '1:02:03')
})

test('calls are interleaved by time', () => {
  const day = (at) => ({ kind: 'day', at })
  const msg = (createdAt) => ({ kind: 'message', message: { createdAt } })
  const call = (startedAt) => ({ id: startedAt, startedAt })
  const items = [
    day('2026-10-07T09:00:00Z'),
    msg('2026-10-07T09:00:00Z'),
    day('2026-10-08T09:00:00Z'),
    msg('2026-10-08T09:00:00Z'),
  ]
  const out = withCalls(items, [
    call('2026-10-08T12:00:00Z'),
    call('2026-10-07T10:00:00Z'),
    call('2026-10-06T10:00:00Z'),
  ])
  assert.deepEqual(
    out.map((i) => (i.kind === 'call' ? `call ${i.call.startedAt.slice(5, 10)}` : i.kind)),
    ['call 10-06', 'day', 'message', 'call 10-07', 'day', 'message', 'call 10-08'],
  )
  assert.equal(withCalls(items, []), items)
})
