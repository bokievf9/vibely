// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcebreakers } from '../../src/features/icebreakers/build.ts'
import { discoverEn } from '../../src/i18n/dictionaries/discover/en.ts'
import { discoverMs } from '../../src/i18n/dictionaries/discover/ms.ts'
import { discoverRu } from '../../src/i18n/dictionaries/discover/ru.ts'

const text = (t) => ({
  t: t.icebreakers,
  tagLabel: (slug) => `#${slug}`,
  question: (key) => `Q:${key}`,
})
const base = {
  seed: 'match-1',
  partnerName: 'Aisyah',
  commonTags: [],
  partnerTags: [],
  prompts: [],
  job: null,
  pets: null,
}

test('no facts: three distinct fallbacks with the name', () => {
  const out = buildIcebreakers(base, text(discoverEn))
  assert.equal(out.length, 3)
  assert.equal(new Set(out).size, 3)
  assert.ok(out.every((s) => s.includes('Aisyah') && !s.includes('{')))
})

test('common tag, prompt and job come first', () => {
  const facts = {
    ...base,
    commonTags: ['hiking'],
    prompts: [{ key: 'mamak_order', answer: 'Roti tisu and teh o ais limau' }],
    job: 'Nurse',
  }
  const out = buildIcebreakers(facts, text(discoverEn))
  assert.ok(out[0].includes('#hiking'))
  assert.ok(out[1].includes('Roti tisu'))
  assert.ok(out[2].includes('Nurse'))
})

test('unknown prompt template uses the default with the question', () => {
  const facts = { ...base, prompts: [{ key: 'green_flags', answer: 'Kindness' }] }
  const [first] = buildIcebreakers(facts, text(discoverEn))
  assert.ok(first.includes('Q:green_flags') && first.includes('Kindness'))
})

test('long answers are shortened, pets used without a job', () => {
  const facts = {
    ...base,
    prompts: [{ key: 'travel_story', answer: 'x'.repeat(150) }],
    pets: 'cat',
  }
  const out = buildIcebreakers(facts, text(discoverEn))
  assert.ok(out[0].includes('…') && out[0].length < 150)
  assert.equal(out[1], discoverEn.icebreakers.pets.cat)
})

test('deterministic per seed, varies across seeds', () => {
  const a = buildIcebreakers(base, text(discoverEn))
  assert.deepEqual(buildIcebreakers(base, text(discoverEn)), a)
  const seeds = ['a', 'b', 'c', 'd', 'e'].map(
    (seed) => buildIcebreakers({ ...base, seed }, text(discoverEn))[0],
  )
  assert.ok(new Set(seeds).size > 1)
})

test('every locale fills all placeholders', () => {
  const facts = {
    ...base,
    commonTags: ['yoga', 'travel'],
    partnerTags: ['cats'],
    prompts: [
      { key: 'ideal_weekend', answer: 'Pantai' },
      { key: 'karaoke_song', answer: 'Lagu' },
    ],
    job: 'Chef',
    pets: 'both',
  }
  for (const t of [discoverEn, discoverMs, discoverRu]) {
    const out = buildIcebreakers(facts, text(t))
    assert.equal(out.length, 3)
    assert.ok(
      out.every((s) => !/\{\w+\}/.test(s)),
      out.join(' | '),
    )
  }
})
