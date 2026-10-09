import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getOwnPhotos, signPhotoPaths } from '@/features/profile/queries'
import { signChatPaths } from '@/features/chat/hydrate'
import { isMissingFunction } from './errors'
import {
  GROUP_MESSAGE_COLUMNS,
  GROUP_PAGE,
  groupListRowSchema,
  groupMemberRowSchema,
  myDuoRowSchema,
  toGroupMessage,
  type DuoPerson,
  type GroupMember,
  type GroupMessage,
  type GroupMessageRow,
  type GroupPreview,
  type GroupRoomData,
  type MyDuo,
  type PersonRow,
} from './types'

type Client = Awaited<ReturnType<typeof createClient>>

// Main photos are signed with the caller's own client: storage RLS decides what they may see.
export async function toPeople<T extends PersonRow>(
  rows: T[],
): Promise<Array<DuoPerson & { row: T }>> {
  const urls = await signPhotoPaths([
    ...new Set(rows.flatMap((r) => (r.photo ? [r.photo.path] : []))),
  ])
  return rows.map((r) => {
    const url = r.photo && urls.get(r.photo.path)
    return {
      row: r,
      id: r.id,
      name: r.display_name,
      username: r.username,
      age: r.age,
      city: r.city,
      photo: r.photo && url ? { url, width: r.photo.width, height: r.photo.height } : null,
    }
  })
}

export function stripRow<T extends { row: unknown }>(person: T): Omit<T, 'row'> {
  const rest: Partial<T> = { ...person }
  delete rest.row
  return rest as Omit<T, 'row'>
}

// The caller's duo and the invites waiting for them. `undefined` when Duo Dating does not exist
// on this database yet (migration 20261009000261 not applied): callers hide every Duo entry point.
export async function getMyDuo(): Promise<MyDuo | undefined> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_duo')
  if (error) {
    if (!isMissingFunction(error.code)) console.error('[duo] get_my_duo failed:', error.code)
    return isMissingFunction(error.code) ? undefined : { team: null, invites: [] }
  }
  const parsed = myDuoRowSchema.safeParse(data)
  if (!parsed.success) return { team: null, invites: [] }
  const { team, invites } = parsed.data
  const people = await toPeople([
    ...(team?.partner ? [team.partner] : []),
    ...invites.map((i) => i.from),
  ])
  const byId = new Map(people.map((p) => [p.id, stripRow(p)]))
  return {
    team: team && {
      id: team.id,
      status: team.status,
      code: team.code,
      bio: team.bio ?? '',
      bioHeld: team.bio_status === 'held',
      minAge: team.min_age,
      maxAge: team.max_age,
      maxKm: team.max_km,
      isLeader: team.is_leader,
      partner: team.partner ? (byId.get(team.partner.id) ?? null) : null,
    },
    invites: invites.flatMap((i) => {
      const from = byId.get(i.from.id)
      return from ? [{ teamId: i.team_id, from, createdAt: i.created_at }] : []
    }),
  }
}

async function toMembers(rows: unknown[]): Promise<GroupMember[]> {
  const parsed = rows.flatMap((r) => {
    const m = groupMemberRowSchema.safeParse(r)
    return m.success ? [m.data] : []
  })
  return (await toPeople(parsed)).map(({ row, ...p }) => ({
    ...p,
    left: row.left,
    memberId: row.member_id ?? null,
    teamId: row.team_id ?? null,
  }))
}

// Group chats for the "Duo chats" section of Chats. Empty when the feature is not available.
export async function getGroupChats(): Promise<GroupPreview[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_group_chats')
  if (error || !Array.isArray(data)) return []
  const rows = data.flatMap((r) => {
    const g = groupListRowSchema.safeParse(r)
    return g.success ? [g.data] : []
  })
  const members = await toMembers(rows.flatMap((g) => g.members))
  const byId = new Map(members.map((m) => [m.id, m]))
  return rows.map((g) => ({
    groupId: g.group_id,
    createdAt: g.created_at,
    members: g.members.flatMap((m) => {
      const p = byId.get(m.id)
      return p ? [{ ...p, left: m.left }] : []
    }),
    last: g.last_message && {
      kind: g.last_message.kind,
      body: g.last_message.body,
      senderId: g.last_message.sender_id,
      systemEvent: g.last_message.system_event,
      aboutUser: g.last_message.about_user,
      at: g.last_message.created_at,
    },
    unread: g.unread,
  }))
}

// Rows → messages with signed photo URLs (storage RLS: current members of the group).
export async function hydrateGroupMessages(
  supabase: Client,
  rows: GroupMessageRow[],
): Promise<GroupMessage[]> {
  const urls = await signChatPaths(
    supabase,
    rows.flatMap((r) => (r.media_path ? [r.media_path] : [])),
  )
  return rows.map((r) => toGroupMessage(r, r.media_path ? (urls.get(r.media_path) ?? null) : null))
}

// Newest page of a group's messages before `before` (oldest first), RLS-limited to members.
export async function loadGroupPage(
  supabase: Client,
  groupId: string,
  before?: string,
): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  let query = supabase
    .from('group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(GROUP_PAGE + 1)
  if (before) query = query.lt('created_at', before)
  const { data } = await query
  const rows = (data ?? []) as GroupMessageRow[]
  const page = rows.slice(0, GROUP_PAGE).reverse()
  return { messages: await hydrateGroupMessages(supabase, page), hasMore: rows.length > GROUP_PAGE }
}

// One group for the chat screen, or null when the caller is not a current member.
export async function getGroupRoom(groupId: string): Promise<GroupRoomData | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_group_chat', { p_group: groupId })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const raw = (data as { members?: unknown }).members
  const [members, page] = await Promise.all([
    toMembers(Array.isArray(raw) ? raw : []),
    loadGroupPage(supabase, groupId),
  ])
  return { groupId, members, ...page }
}

// Unread group messages for the Chats tab badge (0 when the feature is not available).
export async function getGroupUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('group_unread_count')
  return error || typeof data !== 'number' ? 0 : data
}

const ageOf = (birth: string | null, now = new Date()) => {
  if (!birth) return null
  const b = new Date(`${birth}T00:00:00Z`)
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  const m = now.getUTCMonth() - b.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--
  return age
}

// The caller as a duo member (their side of the duo card).
export async function getOwnDuoPerson(userId: string): Promise<DuoPerson | null> {
  const supabase = await createClient()
  const [{ data }, photos] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, birth_date, city')
      .eq('id', userId)
      .maybeSingle(),
    getOwnPhotos(userId),
  ])
  if (!data) return null
  const main = photos[0]
  return {
    id: userId,
    name: data.display_name,
    username: data.username,
    age: ageOf(data.birth_date),
    city: data.city,
    photo: main ? { url: main.url, width: main.width, height: main.height } : null,
  }
}

// Duo Dating exists on this database (migration 20261009000261 applied). Cheap probe.
export async function duoAvailable(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('group_unread_count')
  return !error || !isMissingFunction(error.code)
}
