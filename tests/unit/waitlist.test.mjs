// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  WAITLIST_CITIES,
  formatMalaysianMobile,
  isWaitlistCity,
  normalizeMalaysianMobile,
} from '../../src/features/waitlist/phone.ts'
import { waitlistErrorFromDb } from '../../src/features/waitlist/errors.ts'
import { verifyTurnstile } from '../../src/features/waitlist/turnstile-verify.ts'

const migration = readFileSync(
  new URL('../../supabase/migrations/20261009000300_waitlist.sql', import.meta.url),
  'utf8',
)

test('normalize: every way people type a Malaysian mobile (mirrors join_waitlist)', () => {
  for (const [input, want] of [
    ['12-345 6789', '60123456789'],
    ['012 345 6789', '60123456789'],
    ['+60 12-345 6789', '60123456789'],
    ['60123456789', '60123456789'],
    ['011-2345 6789', '601123456789'],
    ['11 2345 6789', '601123456789'],
  ])
    assert.equal(normalizeMalaysianMobile(input), want, input)
})

test('normalize: shapes that cannot be a Malaysian mobile', () => {
  for (const bad of ['', 'abc', '3-1234 5678', '+65 9123 4567', '12345', '012 345 678901', '6012'])
    assert.equal(normalizeMalaysianMobile(bad), null, bad)
})

test('format: readable number for the success message', () => {
  assert.equal(formatMalaysianMobile('+60123456789'), '+60 12-345 6789')
  assert.equal(formatMalaysianMobile('601123456789'), '+60 112-345 6789')
})

test('cities match public.waitlist_city_ok', () => {
  const sql = migration.match(/p_city in \(([^)]*)\)/)?.[1] ?? ''
  const fromSql = [...sql.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
  assert.deepEqual([...WAITLIST_CITIES].sort(), fromSql.sort())
  assert.equal(isWaitlistCity('penang'), true)
  assert.equal(isWaitlistCity('singapore'), false)
  assert.equal(isWaitlistCity(undefined), false)
})

test('database errors map to form messages', () => {
  assert.equal(waitlistErrorFromDb({ code: 'P0429' }), 'rateLimited')
  assert.equal(waitlistErrorFromDb({ code: 'PGRST202' }), 'unavailable')
  assert.equal(waitlistErrorFromDb({ code: '42883' }), 'unavailable')
  assert.equal(waitlistErrorFromDb({ code: '22023', hint: 'consent' }), 'consentRequired')
  assert.equal(waitlistErrorFromDb({ code: '22023', hint: 'city' }), 'cityInvalid')
  assert.equal(waitlistErrorFromDb({ code: '22023', hint: 'phone' }), 'phoneNotMobile')
  assert.equal(waitlistErrorFromDb({ code: '' }), 'generic')
})

const fakeFetch =
  (reply, calls = []) =>
  async (url, init) => {
    calls.push({ url, body: String(init.body) })
    if (reply instanceof Error) throw reply
    return { ok: true, json: async () => reply }
  }

test('turnstile: skipped without a secret, no request made', async () => {
  const calls = []
  assert.equal(
    await verifyTurnstile({ secret: '', token: 'x', fetchImpl: fakeFetch({}, calls) }),
    'skipped',
  )
  assert.equal(
    await verifyTurnstile({ secret: undefined, token: '', fetchImpl: fakeFetch({}, calls) }),
    'skipped',
  )
  assert.equal(calls.length, 0)
})

test('turnstile: verifies with siteverify, action must match', async () => {
  const calls = []
  const ok = await verifyTurnstile({
    secret: 's3cret',
    token: 'tok',
    ip: '1.2.3.4',
    action: 'waitlist',
    fetchImpl: fakeFetch({ success: true, action: 'waitlist' }, calls),
  })
  assert.equal(ok, 'passed')
  assert.match(calls[0].url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify$/)
  assert.match(calls[0].body, /secret=s3cret/)
  assert.match(calls[0].body, /response=tok/)
  assert.match(calls[0].body, /remoteip=1\.2\.3\.4/)
  assert.equal(
    await verifyTurnstile({
      secret: 's',
      token: 't',
      action: 'waitlist',
      fetchImpl: fakeFetch({ success: true, action: 'send_otp' }),
    }),
    'failed',
  )
})

test('turnstile: fails closed', async () => {
  assert.equal(
    await verifyTurnstile({ secret: 's', token: '', fetchImpl: fakeFetch({ success: true }) }),
    'failed',
  )
  assert.equal(
    await verifyTurnstile({
      secret: 's',
      token: 'x'.repeat(2049),
      fetchImpl: fakeFetch({ success: true }),
    }),
    'failed',
  )
  assert.equal(
    await verifyTurnstile({ secret: 's', token: 't', fetchImpl: fakeFetch({ success: false }) }),
    'failed',
  )
  assert.equal(
    await verifyTurnstile({ secret: 's', token: 't', fetchImpl: fakeFetch(new Error('offline')) }),
    'failed',
  )
})
