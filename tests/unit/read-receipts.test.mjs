// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  laterOf,
  LEGACY_RECEIPTS,
  receiptFor,
  toReadReceipts,
} from '../../src/features/chat/read-receipts.ts'

const msg = (id, createdAt, readAt = null, local) => ({ id, createdAt, readAt, local })

test('read receipts: a missing RPC or odd data is the legacy mode', () => {
  assert.deepEqual(toReadReceipts(null, { code: 'PGRST202' }), LEGACY_RECEIPTS)
  assert.deepEqual(toReadReceipts({ nope: 1 }, null), LEGACY_RECEIPTS)
  assert.deepEqual(toReadReceipts({ enabled: true, seen_up_to: null }, null), {
    mode: 'gated',
    enabled: true,
    seenUpTo: null,
  })
})

test('read receipts: legacy shows "seen" under the last own read message only', () => {
  const a = msg('a', '2026-10-09T10:00:00Z', '2026-10-09T10:01:00Z')
  const b = msg('b', '2026-10-09T10:02:00Z', '2026-10-09T10:03:00Z')
  assert.equal(receiptFor(a, 'b', LEGACY_RECEIPTS), null)
  assert.equal(receiptFor(b, 'b', LEGACY_RECEIPTS), 'seen')
  assert.equal(receiptFor(msg('c', '2026-10-09T10:04:00Z'), 'c', LEGACY_RECEIPTS), null)
})

test('read receipts: gated ticks follow the read-up-to time, "sent" without the perk', () => {
  const r = { mode: 'gated', enabled: true, seenUpTo: '2026-10-09T10:02:00Z' }
  assert.equal(receiptFor(msg('a', '2026-10-09T10:01:00Z'), 'b', r), 'seen')
  assert.equal(receiptFor(msg('b', '2026-10-09T10:02:00Z'), 'b', r), 'seen')
  assert.equal(receiptFor(msg('c', '2026-10-09T10:03:00Z'), 'c', r), 'sent')
  // read_at is ignored in gated mode (an old value must not leak through a disabled perk)
  const off = { mode: 'gated', enabled: false, seenUpTo: null }
  assert.equal(
    receiptFor(msg('d', '2026-10-09T10:00:00Z', '2026-10-09T10:01:00Z'), 'd', off),
    'sent',
  )
  assert.equal(receiptFor(msg('e', '2026-10-09T10:00:00Z', null, 'pending'), 'e', r), null)
})

test('read receipts: the later time wins', () => {
  assert.equal(laterOf(null, '2026-10-09T10:00:00Z'), '2026-10-09T10:00:00Z')
  assert.equal(laterOf('2026-10-09T10:05:00Z', '2026-10-09T10:00:00Z'), '2026-10-09T10:05:00Z')
  assert.equal(laterOf('2026-10-09T10:05:00Z', null), '2026-10-09T10:05:00Z')
})
