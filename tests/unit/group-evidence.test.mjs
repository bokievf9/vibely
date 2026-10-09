// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseGroupTranscript,
  parseHeldDuoBios,
  systemEventText,
} from '../../src/features/admin/group-evidence.ts'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

test('group transcript: parses admin_open_group_transcript output', () => {
  const t = parseGroupTranscript({
    group_id: 'g1',
    members: [
      { id: A, name: 'Aina', left: false },
      { id: B, name: 'Badrul', left: true },
      { name: 'no id' },
    ],
    messages: [
      {
        id: 'm0',
        sender_id: null,
        kind: 'system',
        body: null,
        has_media: false,
        system_event: 'matched',
        about_user: null,
        created_at: '2026-10-01T00:00:00Z',
        reported: false,
      },
      {
        id: 'm1',
        sender_id: B,
        kind: 'image',
        body: null,
        has_media: true,
        system_event: null,
        about_user: null,
        created_at: '2026-10-01T00:01:00Z',
        reported: true,
      },
      { id: 'm2', sender_id: A, kind: 'video', body: 'x' },
    ],
  })
  assert.ok(t)
  assert.equal(t.groupId, 'g1')
  assert.deepEqual(t.members, [
    { id: A, name: 'Aina', left: false },
    { id: B, name: 'Badrul', left: true },
  ])
  assert.equal(t.messages.length, 2, 'unknown kinds are dropped')
  assert.equal(t.messages[0].systemEvent, 'matched')
  assert.equal(t.messages[1].reported, true)
  assert.equal(t.messages[1].hasMedia, true)
})

test('group transcript: rejects malformed input', () => {
  assert.equal(parseGroupTranscript(null), null)
  assert.equal(parseGroupTranscript([]), null)
  assert.equal(parseGroupTranscript({ members: [] }), null)
  assert.deepEqual(parseGroupTranscript({ group_id: 'g' }), {
    groupId: 'g',
    members: [],
    messages: [],
  })
})

test('group transcript: system event lines', () => {
  assert.match(systemEventText('matched', null), /совпали/)
  assert.equal(systemEventText('left', 'Aina'), 'Aina покинул(а) чат')
  assert.match(systemEventText('removed', null), /^Участник удалён/)
  assert.equal(systemEventText(null, 'Aina'), 'Системное сообщение')
})

test('held duo bios: parses admin_held_duo_bios output', () => {
  assert.deepEqual(parseHeldDuoBios(null), [])
  assert.deepEqual(
    parseHeldDuoBios([
      {
        team_id: 't1',
        bio: 'WhatsApp me',
        created_at: '2026-10-09T00:00:00Z',
        members: [
          { id: A, name: 'Aina', username: 'aina' },
          { id: B, name: 'Badrul', username: null },
        ],
      },
      { bio: 'no team id' },
    ]),
    [
      {
        teamId: 't1',
        bio: 'WhatsApp me',
        createdAt: '2026-10-09T00:00:00Z',
        members: [
          { id: A, name: 'Aina', username: 'aina' },
          { id: B, name: 'Badrul', username: null },
        ],
      },
    ],
  )
})
