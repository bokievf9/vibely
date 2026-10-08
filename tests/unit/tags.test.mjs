// Every tag in the catalog migration has a label in each locale, and categories match the app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TAG_CATEGORIES } from '../../src/features/profile/tag-categories.ts'
import { tagCategoriesEn, tagsEn } from '../../src/i18n/dictionaries/tags/en.ts'
import { tagCategoriesMs, tagsMs } from '../../src/i18n/dictionaries/tags/ms.ts'
import { tagCategoriesRu, tagsRu } from '../../src/i18n/dictionaries/tags/ru.ts'

const sql = readFileSync(
  new URL('../../supabase/migrations/20261008000050_tags_catalog.sql', import.meta.url),
  'utf8',
)
const rows = [...sql.matchAll(/^ {2}\('([a-z0-9-]+)', '(?:[^']|'')*', '([a-z]+)', (\d+)\)/gm)].map(
  ([, slug, category, sort]) => ({ slug, category, sort: Number(sort) }),
)
const locales = { en: tagsEn, ms: tagsMs, ru: tagsRu }

test('catalog parsed', () => {
  assert.ok(rows.length >= 80 && rows.length <= 120, `${rows.length} tags`)
  assert.equal(new Set(rows.map((r) => r.slug)).size, rows.length, 'duplicate slugs')
  assert.equal(new Set(rows.map((r) => r.sort)).size, rows.length, 'duplicate sort values')
})

test('categories match the check constraint and the app', () => {
  for (const r of rows) assert.ok(TAG_CATEGORIES.includes(r.category), r.slug)
  for (const c of TAG_CATEGORIES) assert.ok(sql.includes(`'${c}'`), c)
  for (const names of [tagCategoriesEn, tagCategoriesMs, tagCategoriesRu])
    assert.deepEqual(Object.keys(names).sort(), [...TAG_CATEGORIES].sort())
})

test('every slug is translated in en, ms and ru', () => {
  for (const [locale, labels] of Object.entries(locales)) {
    assert.deepEqual(
      Object.keys(labels).sort(),
      rows.map((r) => r.slug).sort(),
      `${locale} labels differ from the catalog`,
    )
    for (const [slug, label] of Object.entries(labels))
      assert.ok(label.trim() && label.length <= 32, `${locale}.${slug}`)
  }
})
