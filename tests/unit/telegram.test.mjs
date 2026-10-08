// npm run test:unit. Never calls api.telegram.org: the API client runs against a mock fetch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  checkAccess,
  decodeCallback,
  encodeCallback,
  isModeratorsChat,
  isValidSecret,
  linkCodeHash,
  maskPhone,
  parseCommand,
  parseUpdate,
  parseUserQuery,
  plain,
} from '../../src/features/telegram/protocol.ts'
import { createThrottle } from '../../src/features/telegram/throttle.ts'
import { createTelegramApi, retryDelayMs } from '../../src/features/telegram/api.ts'

const ID = '0b9f6c1e-3d2a-4c5b-8e7f-1a2b3c4d5e6f'
const GROUP = '-1001234567890'

test('secret: constant-time compare, empty never matches', () => {
  const s = 'a'.repeat(40)
  assert.equal(isValidSecret(s, s), true)
  assert.equal(isValidSecret(s + 'b', s), false)
  assert.equal(isValidSecret('short', s), false)
  assert.equal(isValidSecret(null, s), false)
  assert.equal(isValidSecret('', ''), false)
  assert.equal(isValidSecret(s, ''), false)
})

test('parseUpdate: text message', () => {
  const u = parseUpdate({
    update_id: 7,
    message: {
      message_id: 3,
      text: '/stats',
      chat: { id: -1001234567890, type: 'supergroup' },
      from: { id: 42, is_bot: false, first_name: 'Ana', username: 'ana' },
    },
  })
  assert.equal(u.kind, 'message')
  assert.equal(u.chat.id, -1001234567890)
  assert.equal(u.from.username, 'ana')
  assert.equal(u.text, '/stats')
})

test('parseUpdate: callback query', () => {
  const u = parseUpdate({
    update_id: 8,
    callback_query: {
      id: 'cb1',
      data: `sa:${ID}`,
      from: { id: 42, is_bot: false, first_name: 'Ana' },
      message: { message_id: 9, chat: { id: 42, type: 'private' } },
    },
  })
  assert.equal(u.kind, 'callback')
  assert.equal(u.callbackId, 'cb1')
  assert.equal(u.messageId, 9)
  assert.equal(u.chat.type, 'private')
})

test('parseUpdate: junk and unsupported updates are ignored', () => {
  for (const body of [null, 'x', [], {}, { update_id: 'x' }, { update_id: 1.5 }])
    assert.equal(parseUpdate(body).kind, 'ignored')
  assert.equal(parseUpdate({ update_id: 1, edited_message: {} }).kind, 'ignored')
  assert.equal(
    parseUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 1, type: 'private' },
        from: { id: 2, first_name: 'x' },
      },
    }).kind,
    'ignored',
    'no text',
  )
  assert.equal(
    parseUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        text: '/x',
        chat: { id: 1, type: 'weird' },
        from: { id: 2, first_name: 'x' },
      },
    }).kind,
    'ignored',
    'bad chat type',
  )
  assert.equal(
    parseUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        text: '/x',
        chat: { id: 1, type: 'private' },
        from: { id: 2, is_bot: true, first_name: 'b' },
      },
    }).kind,
    'ignored',
    'bots',
  )
  assert.equal(
    parseUpdate({
      update_id: 1,
      callback_query: { id: 'a', data: 'x'.repeat(65), from: { id: 2, first_name: 'x' } },
    }).kind,
    'ignored',
    'oversized data',
  )
})

test('parseCommand: names, args, bot mentions', () => {
  assert.deepEqual(parseCommand('/ban @siti spam'), { name: 'ban', args: ['@siti', 'spam'] })
  assert.deepEqual(parseCommand('/STATS@VibelyModBot', 'vibelymodbot'), { name: 'stats', args: [] })
  assert.equal(parseCommand('/stats@OtherBot', 'VibelyModBot'), null)
  assert.equal(parseCommand('/unknown'), null)
  assert.equal(parseCommand('hello /stats'), null)
  assert.deepEqual(parseCommand('  /link  ab cd 1234 '), {
    name: 'link',
    args: ['ab', 'cd', '1234'],
  })
})

test('callback data: round trip and 64-byte limit', () => {
  const actions = [
    { a: 'selfie_approve', id: ID },
    { a: 'selfie_reject_menu', id: ID },
    { a: 'selfie_reject', id: ID, code: 'gesture_mismatch' },
    { a: 'selfie_back', id: ID },
    { a: 'report_dismiss', t: 'post', id: ID },
    { a: 'report_hide', t: 'comment', id: ID },
    { a: 'report_ban_menu', t: 'random_session', id: ID },
    { a: 'report_ban_confirm', t: 'user', id: ID, code: 'harassment' },
    { a: 'report_ban', t: 'user', id: ID, code: 'harassment' },
    { a: 'report_back', t: 'user', id: ID },
    { a: 'user_ban', id: ID, code: 'spam' },
    { a: 'user_unban', id: ID },
    { a: 'cancel' },
  ]
  for (const a of actions) {
    const data = encodeCallback(a)
    assert.ok(Buffer.byteLength(data) <= 64, data)
    assert.deepEqual(decodeCallback(data), a)
  }
  assert.throws(() => encodeCallback({ a: 'selfie_reject', id: ID, code: 'x'.repeat(40) }))
})

test('callback data: tampered input rejected', () => {
  for (const bad of [
    '',
    'sa:',
    'sa:not-a-uuid',
    `sa:${ID}:extra`,
    `zz:${ID}`,
    `rd:q:${ID}`,
    `sx:${ID}:DROP TABLE`,
    `sx:${ID}:`,
    `ub:${ID}`,
    'x:1',
    `SA:${ID}`,
  ])
    assert.equal(decodeCallback(bad), null, bad)
})

test('access: chats', () => {
  const group = { id: Number(GROUP), type: 'supergroup' }
  const other = { id: -100999, type: 'supergroup' }
  const dm = { id: 42, type: 'private' }
  assert.equal(isModeratorsChat(group, GROUP), true)
  assert.equal(isModeratorsChat(other, GROUP), false)
  assert.equal(
    isModeratorsChat({ id: -1, type: 'channel', username: 'VibelyMods' }, '@vibelymods'),
    true,
  )
  assert.deepEqual(
    checkAccess({ chat: other, moderatorsChat: GROUP, linked: true, command: 'stats' }),
    { allow: false, reply: false, reason: 'foreign_chat' },
  )
  assert.deepEqual(
    checkAccess({ chat: null, moderatorsChat: GROUP, linked: true, isCallback: true }).allow,
    false,
  )
  assert.equal(
    checkAccess({ chat: group, moderatorsChat: GROUP, linked: false, command: null }).reply,
    false,
    'chatter ignored',
  )
  assert.equal(
    checkAccess({ chat: dm, moderatorsChat: GROUP, linked: true, command: 'stats' }).allow,
    true,
  )
  assert.equal(
    checkAccess({ chat: group, moderatorsChat: GROUP, linked: true, isCallback: true }).allow,
    true,
  )
})

test('access: unlinked users are refused politely, except link/help in private', () => {
  const group = { id: Number(GROUP), type: 'supergroup' }
  const dm = { id: 42, type: 'private' }
  for (const command of ['stats', 'queue', 'user', 'ban', 'unban'])
    for (const chat of [group, dm])
      assert.deepEqual(
        checkAccess({ chat, moderatorsChat: GROUP, linked: false, command }),
        { allow: false, reply: true, reason: 'not_linked' },
        `${command} ${chat.type}`,
      )
  assert.deepEqual(
    checkAccess({ chat: group, moderatorsChat: GROUP, linked: false, isCallback: true }),
    { allow: false, reply: true, reason: 'not_linked' },
  )
  assert.equal(
    checkAccess({ chat: dm, moderatorsChat: GROUP, linked: false, command: 'link' }).allow,
    true,
  )
  assert.equal(
    checkAccess({ chat: dm, moderatorsChat: GROUP, linked: false, command: 'help' }).allow,
    true,
  )
  assert.equal(
    checkAccess({ chat: dm, moderatorsChat: GROUP, linked: false, command: 'start' }).allow,
    true,
  )
  assert.deepEqual(
    checkAccess({ chat: group, moderatorsChat: GROUP, linked: true, command: 'link' }),
    { allow: false, reply: true, reason: 'link_in_group' },
  )
  assert.equal(
    checkAccess({ chat: group, moderatorsChat: GROUP, linked: false, command: 'help' }).allow,
    false,
  )
})

test('formatting: phone mask, plain text, user query', () => {
  assert.equal(maskPhone('60123456789'), '+••••••••789')
  assert.equal(maskPhone('+60 12-345 6789'), '+••••••••789')
  assert.equal(maskPhone(null), '•••')
  assert.equal(plain('a‮b\nc'), 'a b c')
  assert.equal(plain('x'.repeat(100), 10).length, 10)
  assert.deepEqual(parseUserQuery('@Siti_Nur'), { kind: 'username', value: 'siti_nur' })
  assert.deepEqual(parseUserQuery('+60 12-345 6789'), { kind: 'phone', value: '60123456789' })
  assert.deepEqual(parseUserQuery(ID.toUpperCase()), { kind: 'id', value: ID })
  assert.equal(parseUserQuery(''), null)
  assert.equal(parseUserQuery('a b'), null)
  assert.equal(parseUserQuery('%%'), null)
})

test('link code hash matches the database normalisation', () => {
  const expected = createHash('sha256').update('ABCD2345').digest('hex')
  assert.equal(linkCodeHash(' abcd 2345 '), expected)
})

test('throttle: limit per window, then one summary', () => {
  let now = 0
  const t = createThrottle({ limit: 3, windowMs: 60_000, now: () => now })
  assert.deepEqual([t.take('report'), t.take('report'), t.take('report')], ['send', 'send', 'send'])
  assert.equal(t.take('report'), 'suppressed')
  assert.equal(t.take('selfie'), 'suppressed')
  assert.equal(t.drainSummary(), null, 'no room yet')
  assert.equal(t.nextSlotAt(), 60_000)
  now = 60_001
  assert.equal(t.take('report'), 'send')
  // One slot stays reserved for the summary while something is pending.
  assert.equal(t.take('report'), 'send')
  assert.equal(t.take('report'), 'suppressed')
  assert.deepEqual(t.drainSummary(), { report: 2, selfie: 1 })
  assert.equal(t.drainSummary(), null, 'drained once')
})

test('throttle: dedupe keys expire', () => {
  let now = 0
  const t = createThrottle({ limit: 100, now: () => now })
  assert.equal(t.take('alert', 'burst:u1', 1000), 'send')
  assert.equal(t.take('alert', 'burst:u1', 1000), 'duplicate')
  assert.equal(t.take('alert', 'burst:u2', 1000), 'send')
  now = 1001
  assert.equal(t.take('alert', 'burst:u1', 1000), 'send')
  assert.equal(t.drainSummary(), null, 'duplicates are not counted')
})

const TOKEN = '123456:SECRET-token_value'
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function mockApi(responses, extra = {}) {
  const calls = []
  const logs = []
  const sleeps = []
  const api = createTelegramApi({
    token: TOKEN,
    fetch: async (url, init) => {
      calls.push({ url, init })
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    },
    sleep: async (ms) => void sleeps.push(ms),
    log: (m) => logs.push(m),
    ...extra,
  })
  return { api, calls, logs, sleeps }
}

test('api: success, JSON body', async () => {
  const { api, calls } = mockApi([json(200, { ok: true, result: { message_id: 5 } })])
  const r = await api.call('sendMessage', { chat_id: 1, text: 'hi' })
  assert.deepEqual(r, { ok: true, result: { message_id: 5 } })
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.endsWith('/sendMessage'))
  assert.deepEqual(JSON.parse(calls[0].init.body), { chat_id: 1, text: 'hi' })
})

test('api: 429 waits retry_after, 5xx backs off, then succeeds', async () => {
  const { api, calls, sleeps } = mockApi([
    json(429, {
      ok: false,
      error_code: 429,
      description: 'Too Many Requests',
      parameters: { retry_after: 3 },
    }),
    json(502, { ok: false, description: 'Bad Gateway' }),
    json(200, { ok: true, result: true }),
  ])
  const r = await api.call('deleteMessages', { chat_id: 1, message_ids: [1] })
  assert.equal(r.ok, true)
  assert.equal(calls.length, 3)
  assert.deepEqual(sleeps, [3000, 1000])
})

test('api: 4xx is not retried; failures are logged without the token', async () => {
  const { api, calls, logs } = mockApi([
    json(400, { ok: false, description: 'Bad Request: chat not found' }),
  ])
  const r = await api.call('sendMessage', { chat_id: 1, text: 'x' })
  assert.equal(r.ok, false)
  assert.equal(r.status, 400)
  assert.equal(calls.length, 1)
  assert.equal(logs.length, 1)
  assert.ok(!logs[0].includes('SECRET') && !logs[0].includes('123456'), logs[0])
})

test('api: network errors retried, gives up after max attempts', async () => {
  const { api, calls, logs } = mockApi([
    new TypeError('fetch failed'),
    new TypeError('fetch failed'),
    new TypeError('fetch failed'),
  ])
  const r = await api.call('getMe', {})
  assert.equal(r.ok, false)
  assert.equal(calls.length, 3)
  assert.ok(!logs.join().includes('SECRET'))
})

test('api: multipart upload sends bytes, not URLs', async () => {
  const { api, calls } = mockApi([json(200, { ok: true, result: { message_id: 1 } })])
  const photo = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
  await api.upload(
    'sendPhoto',
    { chat_id: -1, caption: 'c', protect_content: true },
    { photo: { name: 'selfie.jpg', data: photo } },
  )
  const form = calls[0].init.body
  assert.ok(form instanceof FormData)
  assert.equal(form.get('chat_id'), '-1')
  assert.equal(form.get('protect_content'), 'true')
  const file = form.get('photo')
  assert.equal(file.name, 'selfie.jpg')
  assert.equal(file.size, 3)
  assert.equal(calls[0].init.headers, undefined, 'fetch sets the multipart boundary')
})

test('retry delay', () => {
  assert.equal(retryDelayMs(1), 500)
  assert.equal(retryDelayMs(3), 2000)
  assert.equal(retryDelayMs(1, 100), 30_000)
})
