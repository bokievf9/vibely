// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { crossedLine, pingDue, PING_INTERVAL_MS } from '../../src/features/crossed-paths/format.ts'
import { crossedEn } from '../../src/i18n/dictionaries/nearby/en.ts'
import { crossedMs, plansMs } from '../../src/i18n/dictionaries/nearby/ms.ts'
import { crossedRu, plansRu } from '../../src/i18n/dictionaries/nearby/ru.ts'
import { plansEn } from '../../src/i18n/dictionaries/nearby/en.ts'

const person = (crossings, today, area = 'Bangsar', city = 'Kuala Lumpur') => ({ crossings, today, area, city })

test('crossed paths line: count, day and area (en)', () => {
  assert.equal(crossedLine(crossedEn, 'en', person(2, true)), 'Crossed paths 2 times today near Bangsar')
  assert.equal(crossedLine(crossedEn, 'en', person(1, false)), 'Crossed paths yesterday near Bangsar')
  assert.equal(crossedLine(crossedEn, 'en', person(3, true, null)), 'Crossed paths 3 times today near Kuala Lumpur')
  assert.equal(crossedLine(crossedEn, 'en', person(2, true, null, null)), 'Crossed paths 2 times today nearby')
})

test('crossed paths line: short form under the strip title', () => {
  assert.equal(crossedLine(crossedEn, 'en', person(2, true), true), '2 times today near Bangsar')
  assert.equal(crossedLine(crossedEn, 'en', person(1, false), true), 'Yesterday near Bangsar')
  assert.equal(crossedLine(crossedRu, 'ru', person(5, true), true), '5 раз сегодня в районе Bangsar')
})

test('crossed paths line: Russian plural forms', () => {
  assert.equal(crossedLine(crossedRu, 'ru', person(2, true)), 'Пересеклись 2 раза сегодня в районе Bangsar')
  assert.equal(crossedLine(crossedRu, 'ru', person(5, false)), 'Пересеклись 5 раз вчера в районе Bangsar')
  assert.equal(crossedLine(crossedMs, 'ms', person(2, true)), 'Berselisih jalan 2 kali hari ini berhampiran Bangsar')
})

test('crossed paths copy: no em or en dashes, never a time', () => {
  for (const dict of [crossedEn, crossedMs, crossedRu, plansEn, plansMs, plansRu]) {
    assert.doesNotMatch(JSON.stringify(dict), /[–—]/)
  }
  for (const dict of [crossedEn, crossedMs, crossedRu]) {
    assert.doesNotMatch(JSON.stringify([dict.today, dict.yesterday, dict.todayShort, dict.yesterdayShort]), /\{(time|hour|minute)\}/)
  }
})

test('pings: at most one attempt every 10 minutes', () => {
  const now = 1_000_000_000
  assert.equal(pingDue(null, now), true)
  assert.equal(pingDue(now - PING_INTERVAL_MS + 1, now), false)
  assert.equal(pingDue(now - PING_INTERVAL_MS, now), true)
  assert.equal(pingDue(now + 60_000, now), true) // clock moved back: do not stall forever
  assert.equal(PING_INTERVAL_MS, 600_000)
})

test('plans: app tags match the SQL check and every language has a label', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261009000200_crossed_paths_plans.sql', import.meta.url), 'utf8')
  const check = sql.match(/tag\s+text not null check \(tag in \(([^)]*)\)\)/)
  assert.ok(check, 'CHECK on user_plans.tag found')
  const sqlTags = [...check[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
  const ts = readFileSync(new URL('../../src/features/plans/tags.ts', import.meta.url), 'utf8')
  const tsTags = [...ts.match(/PLAN_TAGS = \[([^\]]*)\]/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
  assert.deepEqual(tsTags, sqlTags)
  assert.equal(tsTags.length, 18)
  for (const dict of [plansEn, plansMs, plansRu]) assert.deepEqual(Object.keys(dict.tags).sort(), [...tsTags].sort())
})
