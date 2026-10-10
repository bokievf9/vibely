// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { landingEn } from '../../src/i18n/dictionaries/landing/en.ts'
import { landingMs } from '../../src/i18n/dictionaries/landing/ms.ts'
import { landingRu } from '../../src/i18n/dictionaries/landing/ru.ts'
import { waitlistLegal } from '../../src/features/legal/content/waitlist.ts'
import { PLAN_ROWS, planCellText } from '../../src/features/landing/plan-highlights.ts'
import { WAITLIST_ERRORS } from '../../src/features/waitlist/errors.ts'
import { WAITLIST_CITIES } from '../../src/features/waitlist/phone.ts'

const dicts = { en: landingEn, ms: landingMs, ru: landingRu }
const strings = (value) =>
  typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(strings)
const shape = (value) =>
  typeof value === 'string'
    ? 'string'
    : Array.isArray(value)
      ? value.map(shape)
      : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))

test('every locale has the same keys and list lengths as English', () => {
  for (const [locale, dict] of Object.entries(dicts))
    assert.deepEqual(shape(dict), shape(landingEn), locale)
})

test('no em or en dashes in landing copy and the waitlist privacy section', () => {
  for (const [locale, dict] of Object.entries(dicts))
    for (const s of [...strings(dict), ...strings(waitlistLegal[locale])])
      assert.doesNotMatch(s, /[–—]/, `${locale}: ${s}`)
})

test('hero: subtitle at most 20 words, CTA labels short enough for one line', () => {
  for (const [locale, dict] of Object.entries(dicts)) {
    assert.ok(dict.hero.subtitle.split(/\s+/).length <= 20, `${locale}: ${dict.hero.subtitle}`)
    assert.ok(dict.cta.waitlist.length <= 24 && dict.cta.open.length <= 24, locale)
  }
})

test('FAQ has 6 to 8 entries', () => {
  for (const [locale, dict] of Object.entries(dicts))
    assert.ok(dict.faq.length >= 6 && dict.faq.length <= 8, locale)
})

test('waitlist strings cover every error and city', () => {
  for (const [locale, dict] of Object.entries(dicts)) {
    assert.deepEqual(Object.keys(dict.waitlist.errors).sort(), [...WAITLIST_ERRORS].sort(), locale)
    assert.deepEqual(Object.keys(dict.waitlist.cities).sort(), [...WAITLIST_CITIES].sort(), locale)
  }
})

// The landing comparison mirrors the seeded plan matrix (20261009000280_plans.sql).
const plansSql = readFileSync(
  new URL('../../supabase/migrations/20261009000280_plans.sql', import.meta.url),
  'utf8',
)
const LEVELS = ['free', 'plus', 'vip']
const minPlan = Object.fromEntries(
  [...plansSql.matchAll(/\('([a-z0-9_]+)',\s+'[^']*',\s+'(free|plus|vip)'/g)].map((m) => [
    m[1],
    m[2],
  ]),
)
const limits = new Map(
  [
    ...plansSql.matchAll(
      /\('([a-z0-9_]+)',\s+'(free|plus|vip)',\s+(null|\d+),\s+(null|'(?:day|week|month)')\)/g,
    ),
  ].map((m) => [
    `${m[1]}:${m[2]}`,
    {
      n: m[3] === 'null' ? null : Number(m[3]),
      period: m[4] === 'null' ? null : m[4].slice(1, -1),
    },
  ]),
)

test('plan comparison matches the seeded matrix', () => {
  assert.ok(Object.keys(minPlan).length >= 20, 'parsed the features seed')
  assert.ok(limits.size >= 10, 'parsed the limits seed')
  for (const { row, features, cells } of PLAN_ROWS)
    for (const feature of features)
      for (const level of LEVELS) {
        const cell = cells[level]
        const has = LEVELS.indexOf(level) >= LEVELS.indexOf(minPlan[feature])
        const limit = limits.get(`${feature}:${level}`)
        const where = `${row}/${feature}/${level}`
        assert.equal(has, cell.kind !== 'no', where)
        if (cell.kind === 'limit')
          assert.deepEqual(limit, { n: cell.n, period: cell.period }, where)
        if (cell.kind === 'unlimited' || cell.kind === 'yes')
          assert.ok(!limit || limit.n === null, where)
      }
})

test('plan cell text', () => {
  assert.equal(planCellText({ kind: 'limit', n: 100, period: 'day' }, landingEn.plans), '100 a day')
  assert.equal(planCellText({ kind: 'limit', n: 1, period: 'week' }, landingMs.plans), '1 seminggu')
  assert.equal(planCellText({ kind: 'unlimited' }, landingRu.plans), 'Без лимита')
  assert.equal(planCellText({ kind: 'yes' }, landingEn.plans), null)
})
