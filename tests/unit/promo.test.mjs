// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidPromoCode,
  normalizePromoCode,
  outcomeFromResult,
  promoCodeSchema,
  promoErrorKey,
  redeemResultSchema,
} from '../../src/features/promo/schemas.ts'

test('normalize: trim, drop inner whitespace, upper case (mirrors normalize_promo_code)', () => {
  assert.equal(normalizePromoCode('  xmum first_100 '), 'XMUMFIRST_100')
  assert.equal(normalizePromoCode('two-seats'), 'TWO-SEATS')
  assert.equal(normalizePromoCode('\tAbc\n'), 'ABC')
  assert.equal(normalizePromoCode(''), '')
})

test('format mirrors the promo_codes_code_format check', () => {
  for (const good of ['abc', 'XMUM_FIRST_100', 'two-seats', 'a1-_', 'x'.repeat(32), ' ok 1 '])
    assert.equal(isValidPromoCode(good), true, good)
  for (const bad of ['ab', '_abc', '-abc', 'a b!', 'x'.repeat(33), 'промо', '', 'a.b'])
    assert.equal(isValidPromoCode(bad), false, bad)
})

test('schema returns the normalised code or the promoFormat key', () => {
  assert.equal(promoCodeSchema.safeParse(' xmum_first_100 ').data, 'XMUM_FIRST_100')
  const r = promoCodeSchema.safeParse('a b!')
  assert.equal(r.success, false)
  assert.equal(r.error.issues[0].message, 'promoFormat')
})

test('redeem_promo error codes map to translation keys', () => {
  assert.equal(promoErrorKey('invalid'), 'promoInvalid')
  assert.equal(promoErrorKey('expired'), 'promoExpired')
  assert.equal(promoErrorKey('used_up'), 'promoUsedUp')
  assert.equal(promoErrorKey('not_for_you'), 'promoNotForYou')
  assert.equal(promoErrorKey('already_redeemed'), 'promoAlreadyRedeemed')
  assert.equal(promoErrorKey('too_many_attempts'), 'promoTooManyAttempts')
  assert.equal(promoErrorKey('something_new'), 'generic')
})

test('redeem_promo results become outcomes (plans, 20261009000280)', () => {
  const granted = redeemResultSchema.parse({
    status: 'granted',
    code: 'PLUS30',
    benefits: { plan: 'plus', days: 30 },
    plan: 'plus',
    days: 30,
    plan_until: '2026-11-08T00:00:00Z',
    vip_until: null,
    boost_hours: 0,
    boost_until: null,
  })
  assert.deepEqual(outcomeFromResult(granted), {
    status: 'granted',
    code: 'PLUS30',
    plan: 'plus',
    days: 30,
    boostHours: 0,
    planUntil: '2026-11-08T00:00:00Z',
    boostUntil: null,
  })
  const pending = redeemResultSchema.parse({
    status: 'pending',
    code: 'XMUM_FIRST_100',
    benefits: { plan: 'vip', days: 90 },
  })
  assert.deepEqual(outcomeFromResult(pending), {
    status: 'pending',
    code: 'XMUM_FIRST_100',
    plan: 'vip',
    days: 90,
    boostHours: 0,
    planUntil: null,
    boostUntil: null,
  })
  assert.equal(outcomeFromResult({ status: 'error', error: 'used_up' }), 'promoUsedUp')
  assert.equal(redeemResultSchema.safeParse({ status: 'weird' }).success, false)
})

test('old VIP results (before 20261009000280) still read as VIP', () => {
  const granted = redeemResultSchema.parse({
    status: 'granted',
    code: 'TWO-SEATS',
    benefits: { vip_days: 7 },
    vip_days: 7,
    boost_hours: 24,
    vip_until: '2026-10-16T00:00:00Z',
    boost_until: '2026-10-10T00:00:00Z',
    perks: { see_likes: true },
  })
  assert.deepEqual(outcomeFromResult(granted), {
    status: 'granted',
    code: 'TWO-SEATS',
    plan: 'vip',
    days: 7,
    boostHours: 24,
    planUntil: '2026-10-16T00:00:00Z',
    boostUntil: '2026-10-10T00:00:00Z',
  })
  const pending = redeemResultSchema.parse({
    status: 'pending',
    code: 'WOMEN10',
    benefits: { vip_days: 30, boost_hours: 48, see_likes: true, queue_priority: true },
  })
  assert.equal(outcomeFromResult(pending).plan, 'vip')
  assert.equal(outcomeFromResult(pending).days, 30)
})
