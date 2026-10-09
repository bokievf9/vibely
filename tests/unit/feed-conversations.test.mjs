// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  needsUnlock,
  revealProgress,
  REVEAL_UNLOCK_MESSAGES,
} from '../../src/features/blind-date/unlock.ts'
import { percentages, totalAnswers } from '../../src/features/prompts/share.ts'
import { conversationsEn } from '../../src/i18n/dictionaries/conversations/en.ts'
import { conversationsMs } from '../../src/i18n/dictionaries/conversations/ms.ts'
import { conversationsRu } from '../../src/i18n/dictionaries/conversations/ru.ts'

test('reveal unlocks only after 5 messages from each side', () => {
  assert.equal(REVEAL_UNLOCK_MESSAGES, 5)
  assert.deepEqual(revealProgress(0, 0), { unlocked: false, mineLeft: 5, theirsLeft: 5 })
  assert.deepEqual(revealProgress(5, 4), { unlocked: false, mineLeft: 0, theirsLeft: 1 })
  assert.deepEqual(revealProgress(4, 5), { unlocked: false, mineLeft: 1, theirsLeft: 0 })
  assert.deepEqual(revealProgress(5, 5), { unlocked: true, mineLeft: 0, theirsLeft: 0 })
  assert.deepEqual(revealProgress(12, 40), { unlocked: true, mineLeft: 0, theirsLeft: 0 })
})

test('reveal progress tolerates bad counts', () => {
  assert.deepEqual(revealProgress(-3, NaN), { unlocked: false, mineLeft: 5, theirsLeft: 5 })
  assert.deepEqual(revealProgress(2.9, Infinity), { unlocked: false, mineLeft: 3, theirsLeft: 5 })
})

test('only post conversations gate Connect', () => {
  assert.equal(needsUnlock('post'), true)
  assert.equal(needsUnlock('prompt'), false)
  assert.equal(needsUnlock('blind'), false)
})

test('percentages add up to 100', () => {
  assert.deepEqual(percentages([1, 1, 1]), [34, 33, 33])
  assert.deepEqual(percentages([0, 0]), [0, 0])
  assert.deepEqual(percentages([7, 3]), [70, 30])
  assert.deepEqual(percentages([2, 1, 1, 1]), [40, 20, 20, 20])
  for (const counts of [
    [5, 7, 9],
    [1, 2],
    [99, 1, 0, 0],
    [3, 3, 3, 3],
  ]) {
    assert.equal(
      percentages(counts).reduce((a, b) => a + b, 0),
      100,
    )
  }
  assert.equal(totalAnswers([5, -1, NaN, 2.5]), 7)
})

test('conversation dictionaries have the same keys and no dashes', () => {
  const keys = (d) => Object.keys(d).sort().join(',')
  assert.equal(keys(conversationsMs), keys(conversationsEn))
  assert.equal(keys(conversationsRu), keys(conversationsEn))
  for (const dict of [conversationsEn, conversationsMs, conversationsRu]) {
    for (const [k, v] of Object.entries(dict)) {
      assert.ok(!/[–—]/.test(v), `${k} contains an en/em dash`)
    }
  }
})
