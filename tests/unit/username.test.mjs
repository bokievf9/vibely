// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidUsername,
  normalizeUsername,
  searchQuerySchema,
  usernameSchema,
} from '../../src/features/username/schemas.ts'
import { usernameErrorKey } from '../../src/features/username/errors.ts'

test('normalize: trim, lowercase, leading @', () => {
  assert.equal(normalizeUsername('  @@Siti_Nur '), 'siti_nur')
  assert.equal(normalizeUsername('a@b'), 'a@b')
})

test('format mirrors the database rule', () => {
  for (const good of ['abc', 'a_b.c', 'x'.repeat(20), 'ali99', '@Ali99', '_._'])
    assert.equal(isValidUsername(good), true, good)
  for (const bad of ['ab', 'x'.repeat(21), '.abc', 'abc.', 'a..b', 'ab-c', 'ab c', 'абв', ''])
    assert.equal(isValidUsername(bad), false, bad)
})

test('schema returns the normalised value or the error key', () => {
  assert.deepEqual(usernameSchema.safeParse(' @Kuching_Kid ').data, 'kuching_kid')
  const r = usernameSchema.safeParse('a..b')
  assert.equal(r.success, false)
  assert.equal(r.error.issues[0].message, 'usernameInvalid')
})

test('search query needs 2+ characters', () => {
  assert.equal(searchQuerySchema.safeParse(' a ').success, false)
  assert.equal(searchQuerySchema.safeParse('al').success, true)
})

test('database errors map to error keys', () => {
  assert.equal(usernameErrorKey({ code: 'P0430', message: 'username_cooldown' }), 'usernameCooldown')
  assert.equal(usernameErrorKey({ code: '22023', message: 'username_reserved' }), 'usernameReserved')
  assert.equal(usernameErrorKey({ code: '22023', message: 'username_invalid' }), 'usernameInvalid')
  assert.equal(usernameErrorKey({ code: '23505', message: 'username_taken' }), 'usernameTaken')
  assert.equal(
    usernameErrorKey({
      code: '23505',
      message: 'duplicate key value violates unique constraint "profiles_username_key"',
    }),
    'usernameTaken',
  )
  assert.equal(usernameErrorKey({ code: '23514', message: 'Must be 18 or older' }), null)
  assert.equal(usernameErrorKey(null), null)
})
