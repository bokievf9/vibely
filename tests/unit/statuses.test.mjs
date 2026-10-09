// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  codePoints,
  EMOJI_PICKS,
  isSingleEmoji,
  orderStatuses,
  parseSeen,
  PLAN_EMOJI,
  serializeSeen,
  STATUS_HOURS,
  STATUS_MAX_LENGTH,
  timeLeft,
} from '../../src/features/statuses/format.ts'
import { statusErrorsEn, statusesEn } from '../../src/i18n/dictionaries/statuses/en.ts'
import { statusErrorsMs, statusesMs } from '../../src/i18n/dictionaries/statuses/ms.ts'
import { statusErrorsRu, statusesRu } from '../../src/i18n/dictionaries/statuses/ru.ts'
import { statusesLegal } from '../../src/features/legal/content/statuses.ts'

test('limits match the database (60 characters, 3 hours)', () => {
  assert.equal(STATUS_MAX_LENGTH, 60)
  assert.equal(STATUS_HOURS, 3)
})

test('one emoji only', () => {
  for (const ok of ['☕', '🏋️', '👩‍💻', '👍🏽', '🇲🇾', ...EMOJI_PICKS, ...Object.values(PLAN_EMOJI)]) {
    assert.equal(isSingleEmoji(ok), true, ok)
  }
  for (const bad of ['', 'a', '1', '#', '☕☕', '☕ ', ' ', 'hi ☕', '😀'.repeat(9)]) {
    assert.equal(isSingleEmoji(bad), false, JSON.stringify(bad))
  }
})

test('every plan preset has an emoji', () => {
  assert.equal(Object.keys(PLAN_EMOJI).length, 18)
})

test('length counts characters like Postgres char_length', () => {
  assert.equal(codePoints('abc'), 3)
  assert.equal(codePoints('☕ at 5'), 6)
  assert.equal(codePoints('😀'), 1)
})

test('time left is rounded up to the minute and null once expired', () => {
  const now = Date.parse('2026-10-09T10:00:00Z')
  assert.deepEqual(timeLeft('2026-10-09T13:00:00Z', now), { hours: 3, minutes: 0 })
  assert.deepEqual(timeLeft('2026-10-09T10:45:30Z', now), { hours: 0, minutes: 46 })
  assert.equal(timeLeft('2026-10-09T10:00:00Z', now), null)
  assert.equal(timeLeft('not a date', now), null)
})

test('seen state survives bad storage and keeps only live ids', () => {
  assert.deepEqual([...parseSeen(null)], [])
  assert.deepEqual([...parseSeen('{oops')], [])
  assert.deepEqual([...parseSeen('{"a":1}')], [])
  assert.deepEqual([...parseSeen('["a", 2, "b"]')], ['a', 'b'])
  assert.equal(serializeSeen(new Set(['a', 'gone', 'b']), ['a', 'b', 'c']), '["a","b"]')
})

test('unseen statuses come first, each group keeps its order', () => {
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
  assert.deepEqual(
    orderStatuses(items, new Set(['1', '3'])).map((s) => s.id),
    ['2', '4', '1', '3'],
  )
})

test('dictionaries are complete in en / ms / ru without long dashes', () => {
  for (const [dict, errors] of [
    [statusesMs, statusErrorsMs],
    [statusesRu, statusErrorsRu],
  ]) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(statusesEn).sort())
    assert.deepEqual(Object.keys(errors).sort(), Object.keys(statusErrorsEn).sort())
  }
  const all = JSON.stringify([
    statusesEn,
    statusesMs,
    statusesRu,
    statusErrorsEn,
    statusErrorsMs,
    statusErrorsRu,
    statusesLegal,
  ])
  assert.equal(/[–—]/.test(all), false)
  for (const key of ['timeLeft', 'pushReply', 'replyPlaceholder']) {
    for (const d of [statusesEn, statusesMs, statusesRu]) {
      assert.match(d[key], /\{[a-z]+\}/, key)
    }
  }
})

test('privacy and terms describe statuses in every language', () => {
  for (const loc of ['en', 'ms', 'ru']) {
    const { privacy, terms } = statusesLegal[loc]
    assert.ok(privacy.paragraphs.join(' ').includes('60'))
    assert.ok(privacy.paragraphs.join(' ').includes('90'))
    assert.ok(terms.paragraphs.join(' ').includes('10'))
  }
})
