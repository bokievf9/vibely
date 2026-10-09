// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeAuthError,
  isAuthCookieName,
  isDeadSessionError,
} from '../../src/lib/supabase/auth-errors.ts'
import {
  canReloadAgain,
  isOtherBuild,
  isVersionSkewError,
  RELOAD_GUARD_MS,
} from '../../src/features/pwa/skew.ts'

const apiError = (props) => Object.assign(new Error(props.message ?? 'x'), props)

test('auth cookies: session token, chunks and code verifier match', () => {
  for (const name of [
    'sb-abcdefghijklmnop-auth-token',
    'sb-abcdefghijklmnop-auth-token.0',
    'sb-abcdefghijklmnop-auth-token.1',
    'sb-abcdefghijklmnop-auth-token.12',
    'sb-127-auth-token',
    'sb-abcdefghijklmnop-auth-token-code-verifier',
  ]) {
    assert.equal(isAuthCookieName(name), true, name)
  }
})

test('auth cookies: other cookies are kept', () => {
  for (const name of [
    'vibely_locale',
    'vibely_otp_phone',
    'vibely_ref',
    'sb-abc-other',
    'xsb-abc-auth-token',
    'sb--auth-token',
    'sb-abc-auth-token.x',
    'sb-abc-auth-tokenx',
    '',
  ]) {
    assert.equal(isAuthCookieName(name), false, name)
  }
})

test('dead session: refresh failures that never recover', () => {
  for (const code of [
    'refresh_token_already_used',
    'refresh_token_not_found',
    'session_not_found',
    'session_expired',
  ]) {
    assert.equal(isDeadSessionError(apiError({ name: 'AuthApiError', status: 400, code })), true)
  }
  // Older GoTrue: no code, only the 400 and the message.
  assert.equal(
    isDeadSessionError(
      apiError({
        name: 'AuthApiError',
        status: 400,
        message: 'Invalid Refresh Token: Already Used',
      }),
    ),
    true,
  )
  assert.equal(isDeadSessionError(apiError({ name: 'AuthApiError', status: 400 })), true)
})

test('dead session: transient or unrelated errors keep the session', () => {
  assert.equal(isDeadSessionError(null), false)
  assert.equal(isDeadSessionError(undefined), false)
  assert.equal(isDeadSessionError('refresh_token_not_found'), false)
  assert.equal(
    isDeadSessionError(
      apiError({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }),
    ),
    false,
  )
  assert.equal(
    isDeadSessionError(
      apiError({ name: 'AuthRetryableFetchError', status: 503, code: 'refresh_token_not_found' }),
    ),
    false,
  )
  assert.equal(isDeadSessionError(apiError({ name: 'AuthApiError', status: 500 })), false)
  assert.equal(
    isDeadSessionError(apiError({ name: 'AuthSessionMissingError', status: 400 })),
    false,
  )
  assert.equal(
    isDeadSessionError(
      apiError({ name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' }),
    ),
    false,
  )
})

test('dead session: one-line description, no message or token', () => {
  assert.equal(
    describeAuthError(
      apiError({ name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' }),
    ),
    'AuthApiError refresh_token_not_found 400',
  )
})

test('version skew: stale Server Action and chunk errors', () => {
  assert.equal(
    isVersionSkewError(
      apiError({
        name: 'UnrecognizedActionError',
        message: 'Server Action "7f00ab" was not found on the server.',
      }),
    ),
    true,
  )
  assert.equal(
    isVersionSkewError(
      new Error('Server Action "7f00ab" was not found on the server. \nRead more'),
    ),
    true,
  )
  assert.equal(
    isVersionSkewError(
      'Failed to find Server Action "abc". This request might be from an older or newer deployment.',
    ),
    true,
  )
  assert.equal(
    isVersionSkewError(new Error('An unexpected response was received from the server.')),
    true,
  )
  assert.equal(
    isVersionSkewError(new Error('Failed to load chunk /_next/static/chunks/a1.js')),
    true,
  )
  assert.equal(
    isVersionSkewError(apiError({ name: 'ChunkLoadError', message: 'Loading chunk 12 failed.' })),
    true,
  )
})

test('version skew: ordinary errors do not reload', () => {
  assert.equal(isVersionSkewError(null), false)
  assert.equal(isVersionSkewError(42), false)
  assert.equal(isVersionSkewError(new Error('Network request failed')), false)
  assert.equal(isVersionSkewError(new TypeError('Failed to fetch')), false)
  assert.equal(isVersionSkewError({ message: 'unauthorized' }), false)
})

test('version skew: build ids', () => {
  assert.equal(isOtherBuild('b', 'a'), true)
  assert.equal(isOtherBuild('a', 'a'), false)
  assert.equal(isOtherBuild('', 'a'), false)
  assert.equal(isOtherBuild(undefined, 'a'), false)
  assert.equal(isOtherBuild(123, 'a'), false)
})

test('version skew: at most one reload per minute', () => {
  const now = 1_000_000
  assert.equal(canReloadAgain(null, now), true)
  assert.equal(canReloadAgain(Number.NaN, now), true)
  assert.equal(canReloadAgain(now - 1_000, now), false)
  assert.equal(canReloadAgain(now - RELOAD_GUARD_MS + 1, now), false)
  assert.equal(canReloadAgain(now - RELOAD_GUARD_MS, now), true)
  // Clock moved backwards: allow, instead of blocking forever.
  assert.equal(canReloadAgain(now + 5_000, now), true)
})
