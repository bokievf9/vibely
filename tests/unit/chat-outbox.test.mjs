// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimOutgoing, visibleOutgoing } from '../../src/features/chat/chat-state.ts'

const out = (tempId, body, extra = {}) => ({
  tempId,
  body,
  replyTo: null,
  createdAt: '2026-10-09T10:00:00Z',
  status: 'pending',
  claimedBy: null,
  ...extra,
})

test('a Realtime insert claims the oldest matching pending entry once', () => {
  const list = [out('t1', 'hi'), out('t2', 'hi')]
  const first = claimOutgoing(list, { id: 'm1', body: 'hi', replyTo: null })
  assert.equal(first.claimed, true)
  assert.deepEqual(
    first.list.map((o) => o.claimedBy),
    ['m1', null],
  )
  const again = claimOutgoing(first.list, { id: 'm1', body: 'hi', replyTo: null })
  assert.equal(again.list, first.list)
  const second = claimOutgoing(first.list, { id: 'm2', body: 'hi', replyTo: null })
  assert.deepEqual(
    second.list.map((o) => o.claimedBy),
    ['m1', 'm2'],
  )
})

test('a different body, reply target or a failed entry is not claimed', () => {
  const list = [out('t1', 'hi', { replyTo: 'r' }), out('t2', 'yo', { status: 'failed' })]
  assert.equal(claimOutgoing(list, { id: 'm', body: 'hi', replyTo: null }).claimed, false)
  assert.equal(claimOutgoing(list, { id: 'm', body: 'yo', replyTo: null }).claimed, false)
  assert.equal(claimOutgoing(list, { id: 'm', body: 'hi', replyTo: 'r' }).claimed, true)
})

test('claimed entries hide once their message is loaded', () => {
  const list = [out('t1', 'a', { claimedBy: 'm1' }), out('t2', 'b')]
  assert.deepEqual(
    visibleOutgoing(list, new Set()).map((o) => o.tempId),
    ['t1', 't2'],
  )
  assert.deepEqual(
    visibleOutgoing(list, new Set(['m1'])).map((o) => o.tempId),
    ['t2'],
  )
})
