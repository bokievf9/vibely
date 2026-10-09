// Pure helpers for the Duo Dating group chat evidence (admin_open_group_transcript, migration
// 20261009000261) and the held duo bios (admin_held_duo_bios). The RPCs return jsonb, so the
// shape is checked here instead of trusting it. No server-only: also used by client components
// and the unit tests (tests/unit/group-evidence.test.mjs).

export type GroupMember = { id: string; name: string; left: boolean }
export type GroupSystemEvent = 'matched' | 'left' | 'removed'

export type GroupTranscriptMessage = {
  id: string
  senderId: string | null
  kind: 'text' | 'image' | 'system'
  body: string | null
  hasMedia: boolean
  systemEvent: GroupSystemEvent | null
  aboutUser: string | null
  createdAt: string
  reported: boolean
}

export type GroupTranscript = {
  groupId: string
  members: GroupMember[]
  messages: GroupTranscriptMessage[]
}

export type HeldDuoBio = {
  teamId: string
  bio: string
  createdAt: string
  members: { id: string; name: string; username: string | null }[]
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const KINDS = ['text', 'image', 'system'] as const
const EVENTS = ['matched', 'left', 'removed'] as const

export function parseGroupTranscript(raw: unknown): GroupTranscript | null {
  if (!isObj(raw)) return null
  const groupId = str(raw.group_id)
  if (!groupId) return null
  const members = arr(raw.members).flatMap((m): GroupMember[] => {
    const id = isObj(m) ? str(m.id) : null
    if (!isObj(m) || !id) return []
    return [{ id, name: str(m.name) ?? '—', left: m.left === true }]
  })
  const messages = arr(raw.messages).flatMap((m): GroupTranscriptMessage[] => {
    const id = isObj(m) ? str(m.id) : null
    if (!isObj(m) || !id) return []
    const kind = KINDS.find((k) => k === m.kind)
    if (!kind) return []
    return [
      {
        id,
        senderId: str(m.sender_id),
        kind,
        body: str(m.body),
        hasMedia: m.has_media === true,
        systemEvent: EVENTS.find((e) => e === m.system_event) ?? null,
        aboutUser: str(m.about_user),
        createdAt: str(m.created_at) ?? '',
        reported: m.reported === true,
      },
    ]
  })
  return { groupId, members, messages }
}

const EVENT_TEXT: Record<GroupSystemEvent, string> = {
  matched: 'Дуо совпали, чат создан',
  left: 'покинул(а) чат',
  removed: 'удалён(а) из чата (блокировка или бан)',
}

// Readable line for a system message; "about" is the member it concerns (if any).
export function systemEventText(event: GroupSystemEvent | null, about: string | null): string {
  if (!event) return 'Системное сообщение'
  if (event === 'matched') return EVENT_TEXT.matched
  return `${about ?? 'Участник'} ${EVENT_TEXT[event]}`
}

export function parseHeldDuoBios(raw: unknown): HeldDuoBio[] {
  return arr(raw).flatMap((t): HeldDuoBio[] => {
    const teamId = isObj(t) ? str(t.team_id) : null
    if (!isObj(t) || !teamId) return []
    return [
      {
        teamId,
        bio: str(t.bio) ?? '',
        createdAt: str(t.created_at) ?? '',
        members: arr(t.members).flatMap((m) => {
          const id = isObj(m) ? str(m.id) : null
          return isObj(m) && id ? [{ id, name: str(m.name) ?? '—', username: str(m.username) }] : []
        }),
      },
    ]
  })
}
