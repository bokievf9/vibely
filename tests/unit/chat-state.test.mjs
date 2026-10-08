// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyReaction, groupMessages, mergeMessages } from '../../src/features/chat/chat-state.ts'

const msg = (id, senderId, createdAt, extra = {}) => ({
  id,
  senderId,
  createdAt,
  body: id,
  readAt: null,
  editedAt: null,
  deletedAt: null,
  replyTo: null,
  reply: null,
  media: null,
  expiredMedia: null,
  ...extra,
})

test('merge inserts in time order and updates in place', () => {
  const a = msg('a', 'u1', '2026-10-08T10:00:00Z')
  const c = msg('c', 'u1', '2026-10-08T10:02:00Z')
  const b = msg('b', 'u2', '2026-10-08T10:01:00Z')
  const merged = mergeMessages([a, c], [b, { ...a, body: 'edited' }])
  assert.deepEqual(
    merged.map((m) => m.id),
    ['a', 'b', 'c'],
  )
  assert.equal(merged[0].body, 'edited')
})

test('merge keeps signed URL and reply preview missing from Realtime rows', () => {
  const image = { kind: 'image', path: 'm/p.webp', url: 'https://signed', width: 1, height: 1 }
  const reply = { id: 'x', senderId: 'u2', body: 'hi', hasImage: false, deleted: false }
  const old = msg('a', 'u1', '2026-10-08T10:00:00Z', { media: image, replyTo: 'x', reply })
  const row = msg('a', 'u1', '2026-10-08T10:00:00Z', {
    media: { ...image, url: null },
    replyTo: 'x',
    readAt: '2026-10-08T10:05:00Z',
  })
  const [m] = mergeMessages([old], [row])
  assert.equal(m.media.url, 'https://signed')
  assert.equal(m.reply, reply)
  assert.equal(m.readAt, '2026-10-08T10:05:00Z')
  const [deleted] = mergeMessages([old], [{ ...row, media: null, body: null, deletedAt: 'now' }])
  assert.equal(deleted.media, null)
})

test('one reaction per user per message', () => {
  let list = applyReaction([], { messageId: 'm', userId: 'u1', emoji: '❤️' })
  list = applyReaction(list, { messageId: 'm', userId: 'u2', emoji: '😂' })
  list = applyReaction(list, { messageId: 'm', userId: 'u1', emoji: '🔥' })
  assert.deepEqual(
    list.map((r) => `${r.userId}${r.emoji}`),
    ['u2😂', 'u1🔥'],
  )
  assert.equal(applyReaction(list, { messageId: 'm', userId: 'u2', emoji: null }).length, 1)
})

test('day separators and sender groups', () => {
  const day = (iso) => iso.slice(0, 10)
  const items = groupMessages(
    [
      msg('a', 'u1', '2026-10-07T10:00:00Z'),
      msg('b', 'u1', '2026-10-08T10:00:00Z'),
      msg('c', 'u1', '2026-10-08T10:01:00Z'),
      msg('d', 'u2', '2026-10-08T10:02:00Z'),
      msg('e', 'u2', '2026-10-08T11:00:00Z'),
    ],
    day,
  )
  assert.deepEqual(
    items.map((i) =>
      i.kind === 'day'
        ? i.key
        : `${i.message.id}${i.groupStart ? '<' : ''}${i.groupEnd ? '>' : ''}`,
    ),
    ['2026-10-07', 'a<>', '2026-10-08', 'b<', 'c>', 'd<>', 'e<>'],
  )
})
