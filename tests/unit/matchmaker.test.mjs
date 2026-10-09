// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canDecide,
  cardCopy,
  cardPerson,
  filterIntroducible,
  normalizeNote,
  NOTE_MAX,
} from '../../src/features/matchmaker/card.ts'
import { messageKindOf, previewKindOf, referralIdOf } from '../../src/features/chat/message-kind.ts'
import { incognitoEn, matchmakerEn, matchmakerErrorsEn } from '../../src/i18n/dictionaries/matchmaker/en.ts'
import { incognitoMs, matchmakerMs, matchmakerErrorsMs } from '../../src/i18n/dictionaries/matchmaker/ms.ts'
import { incognitoRu, matchmakerRu, matchmakerErrorsRu } from '../../src/i18n/dictionaries/matchmaker/ru.ts'
import { matchmakerLegal } from '../../src/features/legal/content/matchmaker.ts'

const person = (id, name, age = 27) => ({ id, name, age, photo: null })
const B = 'b0000000-0000-4000-8000-000000000001'
const C = 'c0000000-0000-4000-8000-000000000001'

const forB = (state, note = 'You both hike') => ({
  id: 'r', role: 'b', state, note, matchmakerName: 'Arif', person: person(C, 'Mei', 29), matchId: state === 'matched' ? 'm' : null,
})
const forA = (state) => ({ id: 'r', role: 'matchmaker', state, note: null, matchmakerName: 'Arif', b: person(B, 'Siti'), c: person(C, 'Mei') })

test('normalizeNote: trims, collapses whitespace, caps at the limit', () => {
  assert.equal(normalizeNote('  You  both\n\nlove   hiking '), 'You both love hiking')
  assert.equal(normalizeNote('   '), '')
  assert.equal(normalizeNote('x'.repeat(NOTE_MAX + 50)).length, NOTE_MAX)
})

test('filterIntroducible: name words and username, case-insensitive, @ ignored', () => {
  const list = [
    { id: '1', name: 'Siti Nur', username: 'siti.nur', photo: null },
    { id: '2', name: 'Mei Ling', username: 'meiling', photo: null },
    { id: '3', name: 'Aisyah', username: 'aisy', photo: null },
  ]
  assert.deepEqual(filterIntroducible(list, '').map((p) => p.id), ['1', '2', '3'])
  assert.deepEqual(filterIntroducible(list, 'nur').map((p) => p.id), ['1'])
  assert.deepEqual(filterIntroducible(list, '@MEI').map((p) => p.id), ['2'])
  assert.deepEqual(filterIntroducible(list, 'ais').map((p) => p.id), ['3'])
  assert.deepEqual(filterIntroducible(list, 'zzz'), [])
})

test('cardPerson: B/C see the other person, the matchmaker sees the one who is not the chat partner', () => {
  assert.equal(cardPerson(forB('open'), B).id, C)
  assert.equal(cardPerson(forA('pending'), B).id, C)
  assert.equal(cardPerson(forA('pending'), C).id, B)
})

test('canDecide: only an open card of B or C', () => {
  assert.equal(canDecide(forB('open')), true)
  assert.equal(canDecide(forB('interested')), false)
  assert.equal(canDecide(forB('closed')), false)
  assert.equal(canDecide(forA('pending')), false)
})

test('cardCopy: titles and status per state (en)', () => {
  assert.deepEqual(cardCopy(matchmakerEn, forB('open'), 'Arif'), { title: 'Arif wants to introduce you', status: null, showActions: true })
  assert.equal(cardCopy(matchmakerEn, forB('interested'), 'Arif').status, 'You said yes. If Mei is interested too, a chat opens for you both.')
  assert.equal(cardCopy(matchmakerEn, forB('matched'), 'Arif').status, 'It is a match! You and Mei are connected now.')
  assert.equal(cardCopy(matchmakerEn, forB('closed'), 'Arif').status, 'You passed on this introduction.')
  assert.deepEqual(cardCopy(matchmakerEn, forA('pending'), 'Siti'), { title: 'You introduced Siti to Mei', status: 'Waiting for their answer.', showActions: false })
  assert.equal(cardCopy(matchmakerEn, forA('matched'), 'Siti').status, 'They matched. Thank you for the introduction!')
  assert.equal(cardCopy(matchmakerEn, forA('closed'), 'Siti').status, 'This introduction is no longer available.')
})

test('cardCopy: a card without a person (cancelled) reads as unavailable', () => {
  const copy = cardCopy(matchmakerEn, { ...forB('closed'), person: null }, 'Arif')
  assert.deepEqual(copy, { title: 'This introduction is no longer available.', status: null, showActions: false })
  assert.equal(cardCopy(matchmakerRu, forB('open'), 'Ариф').title, 'Ариф хочет вас познакомить')
})

test('previewKindOf: a row with neither text nor media is an introduction card', () => {
  const row = { body: null, media_kind: null, media_expired_at: null, deleted_at: null }
  assert.equal(previewKindOf(row), 'referral')
  assert.equal(previewKindOf({ ...row, kind: 'referral' }), 'referral')
  assert.equal(previewKindOf({ ...row, body: 'hi' }), 'text')
  assert.equal(previewKindOf({ ...row, body: 'note', kind: 'system' }), 'text')
  assert.equal(previewKindOf({ ...row, media_kind: 'image' }), 'photo')
  assert.equal(previewKindOf({ ...row, deleted_at: 'x' }), 'deleted')
  assert.equal(previewKindOf({ ...row, media_kind: 'voice', media_expired_at: 'x' }), 'expired')
})

test('messageKindOf / referralIdOf: kind and referral id, text by default (also without the columns)', () => {
  const base = { body: null }
  assert.deepEqual([messageKindOf(base), referralIdOf(base)], ['text', null])
  const card = { kind: 'referral', payload: { referral_id: 'r1' } }
  assert.deepEqual([messageKindOf(card), referralIdOf(card)], ['referral', 'r1'])
  const note = { kind: 'system', payload: { referral_id: 'r1' }, body: 'note' }
  assert.deepEqual([messageKindOf(note), referralIdOf(note)], ['system', 'r1'])
  assert.deepEqual([messageKindOf({ kind: 'bogus', payload: 'x' }), referralIdOf({ kind: 'referral', payload: {} }), referralIdOf({ kind: 'text', payload: { referral_id: 'r1' } })], ['text', null, null])
})

const flat = (o) => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : flat(v)))

test('copy: all three locales have the same keys and no em/en dashes', () => {
  for (const [en, other] of [[matchmakerEn, matchmakerMs], [matchmakerEn, matchmakerRu], [incognitoEn, incognitoMs], [incognitoEn, incognitoRu], [matchmakerErrorsEn, matchmakerErrorsMs], [matchmakerErrorsEn, matchmakerErrorsRu]]) {
    assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort())
  }
  for (const dict of [matchmakerEn, matchmakerMs, matchmakerRu, incognitoEn, incognitoMs, incognitoRu, matchmakerErrorsEn, matchmakerErrorsMs, matchmakerErrorsRu]) {
    for (const s of flat(dict)) assert.doesNotMatch(s, /[–—]/, s)
  }
  for (const loc of ['en', 'ms', 'ru']) {
    assert.equal(matchmakerLegal[loc].privacy.paragraphs.length, 3)
    for (const s of [matchmakerLegal[loc].privacy.heading, ...matchmakerLegal[loc].privacy.paragraphs]) assert.doesNotMatch(s, /[–—]/, s)
  }
})
