// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSWORD_MIN,
  containsPersonal,
  effectiveLength,
  hasRecentOtp,
  isPlausibleUsername,
  maskPhone,
  normalizeLoginUsername,
  passwordError,
  passwordScore,
  REAUTH_WINDOW_S,
} from '../../src/features/auth/password.ts'
import { normalizeUsername } from '../../src/features/username/schemas.ts'

test('login username: trim, lowercase, strip leading @ (same as the username feature)', () => {
  for (const raw of ['  @@Siti_Nur ', 'ALI.99', '@kuching', 'a@b', ''])
    assert.equal(normalizeLoginUsername(raw), normalizeUsername(raw), raw)
  assert.equal(normalizeLoginUsername(' @Siti_Nur '), 'siti_nur')
})

test('plausible usernames', () => {
  assert.equal(isPlausibleUsername('@Ali99'), true)
  assert.equal(isPlausibleUsername('ab'), false)
  assert.equal(isPlausibleUsername('with space'), false)
})

test('length rules', () => {
  assert.equal(PASSWORD_MIN, 10)
  assert.equal(passwordError('K7#mPq!2v'), 'passwordTooShort')
  assert.equal(passwordError('K7#mPq!2vL'), null)
  // 72-byte bcrypt limit counts bytes, not characters.
  assert.equal(passwordError('kucing makan nasi lemak '.repeat(3) + 'x'), 'passwordTooLong')
  assert.equal(passwordError('ж'.repeat(37)), 'passwordTooLong')
})

test('common and predictable passwords are weak', () => {
  for (const weak of [
    'password12',
    'Password123!',
    'P@ssw0rd2024',
    'Malaysia2024',
    'sayang1234!',
    'Sayangku2023',
    'aaaaaaaaaaaa',
    'abcdefghijkl',
    'qwertyuiop12',
    'abcabcabcabc',
    '0987654321',
    'iloveyou123',
  ])
    assert.equal(passwordError(weak), 'passwordWeak', weak)
})

test('random strings and passphrases pass', () => {
  for (const strong of [
    'kucing makan nasi',
    'correct horse battery',
    'K7#mPq!2vL9z',
    'Tr0ub4dor&3x',
    'xkqbzmwtpr',
    'jalan-jalan cari makan',
    'пароль надёжный 7',
  ])
    assert.equal(passwordError(strong), null, strong)
})

test('score is monotonic-ish and bounded', () => {
  assert.equal(passwordScore(''), 0)
  assert.equal(passwordScore('password'), 0)
  assert.ok(passwordScore('K7#mPq!2vL9z') === 4)
  assert.ok(passwordScore('xkqbzmwtpr') < passwordScore('xkqbzmwtpr#Q8'))
  assert.equal(effectiveLength('aaaa'), 1)
  assert.equal(effectiveLength('1234'), 2)
  assert.equal(effectiveLength('p4ssw0rd'), 1)
})

test('must not contain the username or the phone number', () => {
  const ctx = { username: 'siti_nur', phone: '+60123456789' }
  assert.equal(passwordError('my siti_nur garden', ctx), 'passwordPersonal')
  assert.equal(passwordError('MySitiNurGarden!', ctx), 'passwordPersonal')
  assert.equal(passwordError('kucing 0123456789 x', ctx), 'passwordPersonal')
  assert.equal(passwordError('kucing 12-3456789', ctx), 'passwordPersonal')
  assert.equal(passwordError('kucing +60 12 3456789', ctx), 'passwordPersonal')
  assert.equal(passwordError('kucing makan nasi', ctx), null)
  assert.equal(containsPersonal('anything', { username: 'ab', phone: '123' }), false)
})

test('fresh OTP: amr otp within 10 minutes only', () => {
  const now = 1_800_000_000
  assert.equal(hasRecentOtp([{ method: 'otp', timestamp: now - 60 }], now), true)
  assert.equal(hasRecentOtp([{ method: 'otp', timestamp: now - REAUTH_WINDOW_S - 1 }], now), false)
  assert.equal(hasRecentOtp([{ method: 'password', timestamp: now - 5 }], now), false)
  assert.equal(
    hasRecentOtp(
      [
        { method: 'password', timestamp: now - 5 },
        { method: 'otp', timestamp: now - 30 },
      ],
      now,
    ),
    true,
  )
  assert.equal(hasRecentOtp(['otp'], now), false)
  assert.equal(hasRecentOtp(undefined, now), false)
  assert.equal(hasRecentOtp([{ method: 'otp', timestamp: now + 3600 }], now), false)
})

test('masked phone', () => {
  assert.equal(maskPhone('+60123456789'), '+60 ••• 6789')
  assert.equal(maskPhone('60123456789'), '+60 ••• 6789')
  assert.equal(maskPhone(''), '')
})
