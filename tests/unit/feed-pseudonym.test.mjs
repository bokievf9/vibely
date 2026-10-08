// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PSEUDONYM_ADJECTIVES,
  PSEUDONYM_NOUNS,
  pseudonymColor,
  pseudonymEmoji,
  pseudonymName,
  toPseudonym,
} from '../../src/features/feed/pseudonym.ts'
import { feedEn } from '../../src/i18n/dictionaries/feed/en.ts'
import { feedMs } from '../../src/i18n/dictionaries/feed/ms.ts'
import { feedRu } from '../../src/i18n/dictionaries/feed/ru.ts'

const all = { en: feedEn, ms: feedMs, ru: feedRu }

test('word lists match the database (24 adjectives × 20 nouns) in every locale', () => {
  for (const [locale, dict] of Object.entries(all)) {
    assert.equal(dict.pseudonym.adjectives.length, PSEUDONYM_ADJECTIVES, locale)
    assert.equal(dict.pseudonym.nouns.length, PSEUDONYM_NOUNS, locale)
    assert.equal(new Set(dict.pseudonym.adjectives).size, PSEUDONYM_ADJECTIVES, `${locale} unique`)
    assert.equal(new Set(dict.pseudonym.nouns).size, PSEUDONYM_NOUNS, `${locale} unique`)
  }
})

test('names follow the locale word order', () => {
  const p = { adj: 0, noun: 0, color: 0 }
  assert.equal(pseudonymName(feedEn.pseudonym, p), 'Purple Durian')
  assert.equal(pseudonymName(feedMs.pseudonym, p), 'Durian Ungu')
  assert.equal(pseudonymName(feedRu.pseudonym, p), 'Фиолетовый Дуриан')
  assert.equal(pseudonymName(feedEn.pseudonym, { adj: 1, noun: 2, color: 0 }), 'Sleepy Tapir')
})

test('icons and colors always resolve', () => {
  for (let i = 0; i < 40; i++) {
    const p = { adj: i, noun: i, color: i }
    assert.ok(pseudonymEmoji(p))
    assert.match(pseudonymColor(p), /^bg-/)
    assert.ok(pseudonymName(feedEn.pseudonym, p).length > 3)
  }
})

test('toPseudonym needs all three parts', () => {
  assert.deepEqual(toPseudonym(1, 2, 3), { adj: 1, noun: 2, color: 3 })
  assert.equal(toPseudonym(null, 2, 3), null)
})
