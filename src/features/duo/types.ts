import { z } from 'zod'

// JSON shapes returned by the Duo Dating RPCs (20261009000261) and what the UI gets after the
// storage paths are signed.

export type Photo = { url: string; width: number; height: number }

export const storedPhotoSchema = z
  .object({ path: z.string(), width: z.number(), height: z.number() })
  .nullable()
  .catch(null)

export const personRowSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  username: z.string().nullable().catch(null),
  age: z.number().nullable().catch(null),
  city: z.string().nullable().catch(null),
  photo: storedPhotoSchema.optional().transform((p) => p ?? null),
})
export type PersonRow = z.infer<typeof personRowSchema>

export type DuoPerson = {
  id: string
  name: string
  username: string | null
  age: number | null
  city: string | null
  photo: Photo | null
}

export const myDuoRowSchema = z.object({
  team: z
    .object({
      id: z.uuid(),
      status: z.enum(['pending', 'active']),
      code: z.string().nullable(),
      bio: z.string().nullable(),
      bio_status: z.enum(['ok', 'held']),
      min_age: z.number(),
      max_age: z.number(),
      max_km: z.number(),
      is_leader: z.boolean(),
      partner: personRowSchema.nullable().catch(null),
    })
    .nullable()
    .catch(null),
  invites: z
    .array(z.object({ team_id: z.uuid(), from: personRowSchema, created_at: z.string() }))
    .catch([]),
})

export type DuoTeam = {
  id: string
  status: 'pending' | 'active'
  code: string | null
  bio: string
  bioHeld: boolean
  minAge: number
  maxAge: number
  maxKm: number
  isLeader: boolean
  partner: DuoPerson | null
}

export type DuoInvite = { teamId: string; from: DuoPerson; createdAt: string }

export type MyDuo = { team: DuoTeam | null; invites: DuoInvite[] }

export const candidateRowSchema = z.object({
  team_id: z.uuid(),
  bio: z.string().nullable(),
  distance_km: z.number().nullable(),
  members: z.array(personRowSchema),
})

export type DuoCandidate = {
  teamId: string
  bio: string | null
  distanceKm: number | null
  members: DuoPerson[]
}

export const inboxRowSchema = z.object({
  target_team_id: z.uuid(),
  by: z.object({ id: z.uuid(), display_name: z.string() }),
  mine: z.boolean(),
  created_at: z.string(),
  can_undo: z.boolean(),
  matched: z.boolean(),
  group_id: z.uuid().nullable(),
  team: z.object({ bio: z.string().nullable(), members: z.array(personRowSchema) }),
})

export type DuoInboxItem = {
  teamId: string
  byName: string
  mine: boolean
  createdAt: string
  canUndo: boolean
  matched: boolean
  groupId: string | null
  members: DuoPerson[]
}

export type DecideResult = { matched: boolean; groupId: string | null; justMatched: boolean }

// ---------- group chats ----------

export const groupMemberRowSchema = personRowSchema.extend({
  left: z.boolean(),
  member_id: z.uuid().optional(),
  team_id: z.uuid().nullable().optional(),
})

export type GroupMember = DuoPerson & {
  left: boolean
  memberId: string | null
  teamId: string | null
}

export const groupListRowSchema = z.object({
  group_id: z.uuid(),
  created_at: z.string(),
  members: z.array(groupMemberRowSchema).catch([]),
  last_message: z
    .object({
      kind: z.enum(['text', 'image', 'system']),
      body: z.string().nullable(),
      sender_id: z.uuid().nullable(),
      system_event: z.string().nullable(),
      about_user: z.uuid().nullable(),
      created_at: z.string(),
    })
    .nullable()
    .catch(null),
  unread: z.number().catch(0),
})

export type GroupPreview = {
  groupId: string
  createdAt: string
  members: GroupMember[]
  last: {
    kind: 'text' | 'image' | 'system'
    body: string | null
    senderId: string | null
    systemEvent: string | null
    aboutUser: string | null
    at: string
  } | null
  unread: number
}

// group_messages columns the client reads (RLS: current members only).
export const GROUP_MESSAGE_COLUMNS =
  'id, group_id, sender_id, kind, body, media_path, image_width, image_height, media_expired_at, system_event, about_user, created_at'

export type GroupMessageRow = {
  id: string
  group_id: string
  sender_id: string | null
  kind: string
  body: string | null
  media_path: string | null
  image_width: number | null
  image_height: number | null
  media_expired_at: string | null
  system_event: string | null
  about_user: string | null
  created_at: string
}

export type GroupMessage = {
  id: string
  senderId: string | null
  kind: 'text' | 'image' | 'system'
  body: string | null
  image: { path: string; url: string | null; width: number; height: number } | null
  expired: boolean
  systemEvent: 'matched' | 'left' | 'removed' | null
  aboutUser: string | null
  createdAt: string
}

export const GROUP_PAGE = 50

export function toGroupMessage(r: GroupMessageRow, url: string | null = null): GroupMessage {
  const kind = r.kind === 'image' || r.kind === 'system' ? r.kind : 'text'
  const event = r.system_event
  return {
    id: r.id,
    senderId: r.sender_id,
    kind,
    body: r.body,
    image:
      kind === 'image' && r.media_path && r.image_width && r.image_height
        ? { path: r.media_path, url, width: r.image_width, height: r.image_height }
        : null,
    expired: !!r.media_expired_at,
    systemEvent: event === 'matched' || event === 'left' || event === 'removed' ? event : null,
    aboutUser: r.about_user,
    createdAt: r.created_at,
  }
}

export type GroupRoomData = {
  groupId: string
  members: GroupMember[]
  messages: GroupMessage[]
  hasMore: boolean
}
