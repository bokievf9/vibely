// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeFirst, moveItem } from '../../src/features/profile/photo-order.ts'

test('moveItem shifts the items in between', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c'])
})

test('moveItem ignores out-of-range indexes and returns a copy', () => {
  const items = ['a', 'b']
  const same = moveItem(items, 0, 5)
  assert.deepEqual(same, items)
  assert.notEqual(same, items)
  assert.deepEqual(moveItem(items, -1, 0), items)
})

test('makeFirst keeps the order of the others', () => {
  assert.deepEqual(makeFirst(['a', 'b', 'c'], 2), ['c', 'a', 'b'])
  assert.deepEqual(makeFirst(['a', 'b', 'c'], 0), ['a', 'b', 'c'])
})
