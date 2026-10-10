// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEATURE_KEYS, isFeatureKey } from '../../src/features/plans/access.ts'
import {
  FEATURE_GROUPS,
  GROUP_OF,
  cellFor,
  cellText,
  comparisonGroups,
  parseCatalog,
  planBenefits,
  planIncludes,
  plusVsVip,
} from '../../src/features/plans/comparison.ts'
import {
  PLAN_PRICES,
  PAYMENTS_ENABLED,
  formatPrice,
  monthlyEquivalent,
} from '../../src/features/plans/pricing.ts'
import { plansEn } from '../../src/i18n/dictionaries/plans/en.ts'
import { plansMs } from '../../src/i18n/dictionaries/plans/ms.ts'
import { plansRu } from '../../src/i18n/dictionaries/plans/ru.ts'

// The owner's matrix as seeded in 20261009000280.
const seedFeatures = [
  ['likes_per_day', 'free', 10],
  ['who_liked_you', 'plus', 20],
  ['chat_photos', 'plus', 30],
  ['voice_messages', 'plus', 40],
  ['video_messages', 'plus', 50],
  ['calls', 'vip', 60],
  ['feed_post', 'plus', 70],
  ['feed_comment', 'plus', 80],
  ['feed_like', 'free', 90],
  ['blind_dating_per_day', 'free', 100],
  ['event_priority', 'vip', 110],
  ['incognito', 'plus', 120],
  ['boost', 'plus', 130],
  ['crush_links_per_30d', 'free', 140],
  ['duo', 'free', 150],
  ['statuses', 'free', 160],
  ['crossed_paths', 'free', 170],
  ['vip_badge', 'vip', 180],
  ['read_receipts', 'vip', 190],
  ['profile_visitors', 'vip', 200],
  ['discover_priority', 'vip', 210],
  ['message_before_match', 'vip', 220],
].map(([key, min_plan, sort]) => ({ key, min_plan, enabled: true, sort }))
const seedLimits = [
  ['likes_per_day', 'free', 100, 'day'],
  ['likes_per_day', 'plus', null, null],
  ['likes_per_day', 'vip', null, null],
  ['blind_dating_per_day', 'free', 3, 'day'],
  ['blind_dating_per_day', 'plus', 10, 'day'],
  ['blind_dating_per_day', 'vip', null, null],
  ['boost', 'plus', 1, 'month'],
  ['boost', 'vip', 1, 'week'],
  ['crush_links_per_30d', 'free', 1, 'month'],
  ['crush_links_per_30d', 'plus', 3, 'month'],
  ['crush_links_per_30d', 'vip', 5, 'month'],
  ['message_before_match', 'vip', 1, 'day'],
].map(([feature_key, plan, limit_value, period]) => ({ feature_key, plan, limit_value, period }))

const catalog = () => parseCatalog(seedFeatures, seedLimits, isFeatureKey)
const byKey = (c, k) => c.find((f) => f.key === k)

test('every feature key has a theme and labels in en/ms/ru', () => {
  for (const k of FEATURE_KEYS) {
    assert.ok(FEATURE_GROUPS.includes(GROUP_OF[k]), k)
    for (const d of [plansEn, plansMs, plansRu]) {
      assert.ok(d.featureNames[k]?.length > 1, `featureNames.${k}`)
      assert.ok(d.features[k]?.length > 1, `features.${k}`)
    }
  }
  for (const d of [plansEn, plansMs, plansRu])
    for (const g of FEATURE_GROUPS) assert.ok(d.groups[g]?.length > 1, g)
})

test('parseCatalog skips unknown keys and bad rows', () => {
  const c = parseCatalog(
    [
      ...seedFeatures,
      { key: 'future_thing', min_plan: 'vip', enabled: true, sort: 999 },
      { key: 'boost', min_plan: 'gold', enabled: true, sort: 1 },
    ].slice(),
    [...seedLimits, { feature_key: 'boost', plan: 'gold', limit_value: 9, period: 'day' }],
    isFeatureKey,
  )
  assert.equal(c.length, 22)
  assert.equal(c.filter((f) => f.key === 'boost').length, 1)
  assert.deepEqual(byKey(c, 'boost').limits, {
    plus: { limit: 1, period: 'month' },
    vip: { limit: 1, period: 'week' },
  })
})

test('cells mirror has_feature / feature_limit', () => {
  const c = catalog()
  assert.deepEqual(cellFor(byKey(c, 'likes_per_day'), 'free'), {
    kind: 'limit',
    limit: 100,
    period: 'day',
  })
  assert.deepEqual(cellFor(byKey(c, 'likes_per_day'), 'plus'), { kind: 'unlimited' })
  assert.deepEqual(cellFor(byKey(c, 'chat_photos'), 'free'), { kind: 'no' })
  assert.deepEqual(cellFor(byKey(c, 'chat_photos'), 'plus'), { kind: 'yes' })
  assert.deepEqual(cellFor(byKey(c, 'calls'), 'plus'), { kind: 'no' })
  assert.deepEqual(cellFor(byKey(c, 'calls'), 'vip'), { kind: 'yes' })
  // A quota feature without a row for the plan (boost has none for free) is not included below
  // its min plan, and a 0 limit means "not included".
  assert.deepEqual(cellFor(byKey(c, 'boost'), 'free'), { kind: 'no' })
  assert.deepEqual(
    cellFor({ ...byKey(c, 'boost'), limits: { plus: { limit: 0, period: 'month' } } }, 'plus'),
    { kind: 'no' },
  )
  // Disabled: nobody (but staff) has it.
  assert.deepEqual(cellFor({ ...byKey(c, 'feed_like'), enabled: false }, 'vip'), { kind: 'no' })
})

test('comparison is grouped by theme in the matrix order and follows admin changes', () => {
  const groups = comparisonGroups(catalog())
  assert.deepEqual(
    groups.map((g) => g.group),
    ['chat', 'discover', 'blind', 'feed', 'privacy', 'extras'],
  )
  assert.deepEqual(
    groups[0].rows.map((r) => r.key),
    [
      'chat_photos',
      'voice_messages',
      'video_messages',
      'calls',
      'read_receipts',
      'message_before_match',
    ],
  )
  assert.equal(groups.flatMap((g) => g.rows).length, 22)
  // Admin moves chat photos to free and disables the feed likes.
  const edited = catalog().map((f) =>
    f.key === 'chat_photos'
      ? { ...f, minPlan: 'free' }
      : f.key === 'feed_like'
        ? { ...f, enabled: false }
        : f,
  )
  const rows = comparisonGroups(edited).flatMap((g) => g.rows)
  assert.equal(rows.find((r) => r.key === 'chat_photos').cells.free.kind, 'yes')
  assert.equal(
    rows.some((r) => r.key === 'feed_like'),
    false,
  )
  // A theme left without rows disappears.
  const noIncognito = catalog().map((f) => (f.key === 'incognito' ? { ...f, enabled: false } : f))
  assert.equal(
    comparisonGroups(noIncognito).some((g) => g.group === 'privacy'),
    false,
  )
})

test('limit text', () => {
  const t = plansEn.cell
  assert.equal(cellText({ kind: 'limit', limit: 100, period: 'day' }, t), '100 per day')
  assert.equal(cellText({ kind: 'limit', limit: 1, period: 'week' }, t), '1 per week')
  assert.equal(cellText({ kind: 'limit', limit: 3, period: 'month' }, t), '3 per 30 days')
  assert.equal(cellText({ kind: 'limit', limit: 7, period: null }, t), '7')
  assert.equal(cellText({ kind: 'unlimited' }, t), 'Unlimited')
  assert.equal(cellText({ kind: 'yes' }, t), 'Included')
  assert.equal(cellText({ kind: 'no' }, t), 'Not included')
  assert.equal(cellText({ kind: 'limit', limit: 100, period: 'day' }, plansRu.cell), '100 в день')
  assert.equal(
    cellText({ kind: 'limit', limit: 3, period: 'month' }, plansMs.cell),
    '3 setiap 30 hari',
  )
})

test('top benefits: what the plan adds over the level below', () => {
  const c = catalog()
  assert.deepEqual(
    planBenefits(c, 'plus').map((b) => b.key),
    ['likes_per_day', 'who_liked_you', 'chat_photos', 'voice_messages'],
  )
  assert.deepEqual(
    planBenefits(c, 'vip').map((b) => b.key),
    ['calls', 'profile_visitors', 'read_receipts', 'message_before_match'],
  )
  // Higher quotas count: VIP lifts the Blind Dating cap and the boost to weekly.
  const vipAll = planBenefits(c, 'vip', 50).map((b) => b.key)
  assert.ok(
    vipAll.includes('blind_dating_per_day') &&
      vipAll.includes('boost') &&
      !vipAll.includes('likes_per_day'),
  )
  assert.deepEqual(
    planIncludes(c, 'free').map((b) => b.key),
    ['likes_per_day', 'blind_dating_per_day', 'crush_links_per_30d', 'feed_like'],
  )
})

test('Plus vs VIP rows lead with the tapped feature', () => {
  const c = catalog()
  const rows = plusVsVip(c, 'chat_photos')
  assert.equal(rows[0].key, 'chat_photos')
  assert.equal(rows.length, 4)
  assert.ok(
    rows
      .slice(1)
      .every(
        (r) =>
          r.cells.plus.kind !== r.cells.vip.kind ||
          JSON.stringify(r.cells.plus) !== JSON.stringify(r.cells.vip),
      ),
  )
  assert.deepEqual(
    plusVsVip(c).map((r) => r.key),
    ['calls', 'profile_visitors', 'read_receipts', 'message_before_match'],
  )
})

test('pricing is not set and payments are off', () => {
  assert.equal(PAYMENTS_ENABLED, false)
  for (const p of Object.values(PLAN_PRICES))
    for (const v of Object.values(p)) assert.equal(v, null)
  assert.match(formatPrice({ amount: 29.9, currency: 'MYR' }), /RM\s?29\.90/)
  assert.deepEqual(monthlyEquivalent({ amount: 120, currency: 'MYR' }, 'year'), {
    amount: 10,
    currency: 'MYR',
  })
  assert.equal(monthlyEquivalent({ amount: 20, currency: 'MYR' }, 'month'), null)
})

test('paywall copy has no em or en dashes', () => {
  const walk = (v) => (typeof v === 'string' ? [v] : Object.values(v).flatMap(walk))
  for (const d of [plansEn, plansMs, plansRu])
    for (const s of walk(d)) assert.ok(!/[–—]/.test(s), s)
})
