// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileCompleteness } from '../../src/features/profile/completeness.ts'

const empty = { photoCount: 0, bio: '', promptCount: 0, aboutFilled: [] }

test('empty profile is 0% and asks for photos first', () => {
  assert.deepEqual(profileCompleteness(empty), { percent: 0, hint: 'photos' })
})

test('complete profile is 100% with no hint', () => {
  const full = { photoCount: 6, bio: 'Hi', promptCount: 3, aboutFilled: Array(9).fill(true) }
  assert.deepEqual(profileCompleteness(full), { percent: 100, hint: null })
})

test('photos and bio but no prompts: nudges prompts', () => {
  const r = profileCompleteness({
    ...empty,
    photoCount: 3,
    bio: 'Hello',
    aboutFilled: [true, true],
  })
  assert.equal(r.percent, 55)
  assert.equal(r.hint, 'prompts')
})

test('blank bio does not count', () => {
  assert.equal(profileCompleteness({ ...empty, bio: '   ' }).percent, 0)
})

test('partial prompts and about are proportional', () => {
  const r = profileCompleteness({ photoCount: 3, bio: 'x', promptCount: 1, aboutFilled: [true] })
  assert.equal(r.percent, 30 + 15 + 10 + 5)
  assert.equal(r.hint, 'prompts') // tie (20 vs 20): prompts win
})
