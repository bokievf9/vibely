// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  FEATURE_KEYS,
  FULL_ACCESS,
  featureLimit,
  featureRemaining,
  featuresOf,
  hasFeature,
  parseAccess,
  upgradePlanFor,
  withUse,
} from '../../src/features/plans/access.ts'
import { planFail, upgradeFromError } from '../../src/features/plans/errors.ts'
import { planErrorsEn, plansEn } from '../../src/i18n/dictionaries/plans/en.ts'
import { planErrorsMs, plansMs } from '../../src/i18n/dictionaries/plans/ms.ts'
import { planErrorsRu, plansRu } from '../../src/i18n/dictionaries/plans/ru.ts'

const f = (on, min_plan, limit = null, period = null, used = null) => ({
  on,
  min_plan,
  limit,
  period,
  used,
})
const free = {
  plan: 'free',
  is_staff: false,
  plan_until: null,
  boost_until: null,
  features: {
    likes_per_day: f(true, 'free', 100, 'day', 98),
    chat_photos: f(false, 'plus'),
    calls: f(false, 'vip'),
    who_liked_you: f(false, 'plus'),
    boost: f(false, 'plus', 0),
    some_future_key: f(true, 'free'),
  },
}

test('feature keys match the seeds of 20261009000280', () => {
  const sql = readFileSync(
    new URL('../../supabase/migrations/20261009000280_plans.sql', import.meta.url),
    'utf8',
  )
  const seeds = sql.slice(
    sql.indexOf('insert into public.features'),
    sql.indexOf('insert into public.plan_limits'),
  )
  const keys = [...seeds.matchAll(/\('([a-z0-9_]+)',/g)].map((m) => m[1])
  assert.deepEqual([...keys].sort(), [...FEATURE_KEYS].sort())
})

test('my_access parses; unknown keys are ignored', () => {
  const a = parseAccess(free)
  assert.equal(a.available, true)
  assert.equal(a.plan, 'free')
  assert.equal('some_future_key' in a.features, false)
  assert.equal(hasFeature(a, 'chat_photos'), false)
  assert.equal(hasFeature(a, 'likes_per_day'), true)
  assert.equal(featureLimit(a, 'likes_per_day'), 100)
  assert.equal(featureRemaining(a, 'likes_per_day'), 2)
  assert.equal(
    featureRemaining(
      withUse(withUse(withUse(a, 'likes_per_day'), 'likes_per_day'), 'likes_per_day'),
      'likes_per_day',
    ),
    0,
  )
  assert.equal(featureLimit(a, 'chat_photos'), 0)
})

test('missing or broken my_access allows everything (as before plans)', () => {
  for (const bad of [null, {}, { plan: 'gold' }, 'x']) {
    const a = parseAccess(bad)
    assert.equal(a, FULL_ACCESS)
    assert.equal(hasFeature(a, 'calls'), true)
    assert.equal(featureLimit(a, 'likes_per_day'), null)
    assert.equal(featureRemaining(a, 'boost'), null)
  }
})

test('the upgrade target: min plan, or the next level when the quota is used', () => {
  const a = parseAccess(free)
  assert.equal(upgradePlanFor(a, 'chat_photos'), 'plus')
  assert.equal(upgradePlanFor(a, 'calls'), 'vip')
  assert.equal(upgradePlanFor(a, 'likes_per_day'), 'plus')
  const plus = parseAccess({ ...free, plan: 'plus' })
  assert.equal(upgradePlanFor(plus, 'boost'), 'vip')
  assert.deepEqual(featuresOf(a, 'plus'), ['who_liked_you', 'chat_photos', 'boost'])
})

test('VP402 becomes an upgrade, anything else does not', () => {
  assert.deepEqual(upgradeFromError({ code: 'VP402', details: 'chat_photos', hint: 'feature' }), {
    feature: 'chat_photos',
    reason: 'feature',
  })
  assert.deepEqual(upgradeFromError({ code: 'VP402', details: 'likes_per_day', hint: 'limit' }), {
    feature: 'likes_per_day',
    reason: 'limit',
  })
  assert.deepEqual(upgradeFromError({ code: 'VP402', details: 'calls', hint: 'partner' }), {
    feature: 'calls',
    reason: 'partner',
  })
  assert.equal(upgradeFromError({ code: 'VP402', details: null, hint: 'feature' }), null)
  assert.equal(upgradeFromError({ code: 'VP402', details: 'Bad Key!', hint: 'feature' }), null)
  assert.equal(upgradeFromError({ code: 'P0429', details: 'calls' }), null)
  assert.equal(upgradeFromError(null), null)
  assert.deepEqual(planFail({ code: 'VP402', details: 'boost', hint: 'limit' }), {
    ok: false,
    error: 'planLimit',
    upgrade: { feature: 'boost', reason: 'limit' },
  })
  assert.equal(planFail({ code: '23505' }), null)
})

test('plans copy: every feature has a line in every language, no em or en dashes', () => {
  for (const dict of [plansEn, plansMs, plansRu]) {
    assert.deepEqual(Object.keys(dict.features).sort(), [...FEATURE_KEYS].sort())
    assert.doesNotMatch(JSON.stringify(dict), /[–—]/)
  }
  for (const errors of [planErrorsEn, planErrorsMs, planErrorsRu]) {
    assert.deepEqual(Object.keys(errors).sort(), ['planLimit', 'planPartner', 'planRequired'])
    assert.doesNotMatch(JSON.stringify(errors), /[–—]/)
  }
})
