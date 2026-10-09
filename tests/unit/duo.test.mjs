// npm run test:unit. Duo Dating: error mapping, undo window, group message rows, dictionaries.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DUO_BIO_MAX,
  INVITE_CODE_RE,
  duoErrorKey,
  groupSendErrorKey,
  isMissingFunction,
  undoMinutesLeft,
} from '../../src/features/duo/errors.ts'
import { personRowSchema, toGroupMessage } from '../../src/features/duo/types.ts'
import { duoEn, duoErrorsEn } from '../../src/i18n/dictionaries/duo/en.ts'
import { duoErrorsMs, duoMs } from '../../src/i18n/dictionaries/duo/ms.ts'
import { duoErrorsRu, duoRu } from '../../src/i18n/dictionaries/duo/ru.ts'
import { duoLegal } from '../../src/features/legal/content/duo.ts'

test('SQLSTATEs of the duo RPCs map to error keys', () => {
  assert.equal(duoErrorKey('VD001'), 'duoActive')
  assert.equal(duoErrorKey('VD002'), 'duoPartnerBusy')
  assert.equal(duoErrorKey('VD003'), 'duoInviteInvalid')
  assert.equal(duoErrorKey('VD004'), 'duoNotAvailable')
  assert.equal(duoErrorKey('P0429'), 'rateLimited')
  assert.equal(duoErrorKey('VS001'), 'muted')
  assert.equal(duoErrorKey('XX000'), 'generic')
  assert.equal(duoErrorKey(undefined, 'notFound'), 'notFound')
  assert.equal(groupSendErrorKey('42501'), 'groupNotMember')
  assert.equal(groupSendErrorKey('VS001'), 'muted')
  assert.ok(isMissingFunction('PGRST202'))
  assert.ok(!isMissingFunction('42501'))
})

test('every error key exists in all three languages', () => {
  for (const errors of [duoErrorsMs, duoErrorsRu]) {
    assert.deepEqual(Object.keys(errors).sort(), Object.keys(duoErrorsEn).sort())
  }
})

test('undo window: whole minutes left, 0 after one hour', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  assert.equal(undoMinutesLeft('2026-10-09T12:00:00Z', now), 60)
  assert.equal(undoMinutesLeft('2026-10-09T11:30:30Z', now), 31)
  assert.equal(undoMinutesLeft('2026-10-09T11:00:30Z', now), 1)
  assert.equal(undoMinutesLeft('2026-10-09T11:00:00Z', now), 0)
  assert.equal(undoMinutesLeft('2026-10-09T10:00:00Z', now), 0)
})

test('invite codes and the bio limit mirror the duo_teams checks', () => {
  assert.ok(INVITE_CODE_RE.test('ab12cd34'))
  assert.ok(!INVITE_CODE_RE.test('AB12CD34'))
  assert.ok(!INVITE_CODE_RE.test('ab12cd3'))
  assert.ok(!INVITE_CODE_RE.test('ab12cd34x'))
  assert.equal(DUO_BIO_MAX, 120)
})

test('group message rows: text, photo, purged photo, system', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000001',
    group_id: '00000000-0000-4000-8000-000000000002',
    sender_id: '00000000-0000-4000-8000-000000000003',
    body: null,
    media_path: null,
    image_width: null,
    image_height: null,
    media_expired_at: null,
    system_event: null,
    about_user: null,
    created_at: '2026-10-09T12:00:00Z',
  }
  const text = toGroupMessage({ ...base, kind: 'text', body: 'hi' })
  assert.equal(text.kind, 'text')
  assert.equal(text.image, null)
  const photo = toGroupMessage(
    { ...base, kind: 'image', media_path: 'g/p.webp', image_width: 10, image_height: 20 },
    'https://signed',
  )
  assert.deepEqual(photo.image, { path: 'g/p.webp', url: 'https://signed', width: 10, height: 20 })
  const purged = toGroupMessage({
    ...base,
    kind: 'image',
    image_width: 10,
    image_height: 20,
    media_expired_at: '2026-10-09T12:00:00Z',
  })
  assert.equal(purged.image, null)
  assert.ok(purged.expired)
  const system = toGroupMessage({
    ...base,
    sender_id: null,
    kind: 'system',
    system_event: 'left',
    about_user: base.sender_id,
  })
  assert.equal(system.systemEvent, 'left')
  assert.equal(toGroupMessage({ ...base, kind: 'system', system_event: 'weird' }).systemEvent, null)
})

test('person rows: a missing photo is null, a broken one too', () => {
  const p = {
    id: '00000000-0000-4000-8000-000000000001',
    display_name: 'Aisyah',
    username: 'aisyah',
    age: 24,
    city: null,
  }
  assert.equal(personRowSchema.parse(p).photo, null)
  assert.equal(personRowSchema.parse({ ...p, photo: { path: 1 } }).photo, null)
  assert.deepEqual(
    personRowSchema.parse({ ...p, photo: { path: 'x', width: 1, height: 2 } }).photo,
    {
      path: 'x',
      width: 1,
      height: 2,
    },
  )
})

const strings = (value) =>
  typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap((v) => strings(v))

test('duo texts: same keys and placeholders in en/ms/ru, no em or en dashes', () => {
  for (const dict of [duoMs, duoRu]) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(duoEn).sort())
    for (const [key, value] of Object.entries(duoEn)) {
      const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      assert.deepEqual(vars(dict[key]), vars(value), key)
    }
  }
  const all = [duoEn, duoMs, duoRu, duoErrorsEn, duoErrorsMs, duoErrorsRu, duoLegal].flatMap(
    strings,
  )
  for (const s of all) assert.ok(!/[–—]/.test(s), s)
})
