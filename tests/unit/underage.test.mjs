// npm run test:unit. "Looks under 18" reason codes (20261010000100).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BAN_CODES,
  REJECTION_CODES,
  SHOWN_REJECTION_CODES,
  UNDERAGE_CODE,
  localizeReason,
  parseReason,
} from '../../src/features/safety/reason-codes.ts'

test('underage: not a plain rejection preset, but shown to users and a ban code', () => {
  assert.equal(REJECTION_CODES.includes(UNDERAGE_CODE), false)
  assert.equal(SHOWN_REJECTION_CODES.includes(UNDERAGE_CODE), true)
  assert.equal(BAN_CODES.includes(UNDERAGE_CODE), true)
  for (const c of REJECTION_CODES) assert.ok(SHOWN_REJECTION_CODES.includes(c), c)
})

test('underage: the stored reason localizes and parses', () => {
  const labels = Object.fromEntries(SHOWN_REJECTION_CODES.map((c) => [c, `L:${c}`]))
  assert.equal(localizeReason('underage', SHOWN_REJECTION_CODES, labels), 'L:underage')
  // the old list leaves it raw: the selfie page must use SHOWN_REJECTION_CODES
  assert.equal(localizeReason('underage', REJECTION_CODES, labels), 'underage')
  assert.deepEqual(parseReason('underage', BAN_CODES), { code: 'underage', note: '' })
})
