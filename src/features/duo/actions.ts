'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import {
  notifyDuoInvite,
  notifyDuoMatch,
  notifyDuoPartnerLiked,
  notifyGroupMessage,
} from '@/features/push/send'
import { AGE_MAX, AGE_MIN, DISTANCE_MAX_KM } from '@/features/swipe/schemas'
import { DUO_BIO_MAX, INVITE_CODE_RE, duoErrorKey, groupSendErrorKey } from './errors'
import { getMyDuo, hydrateGroupMessages, loadGroupPage, stripRow, toPeople } from './queries'
import {
  GROUP_MESSAGE_COLUMNS,
  candidateRowSchema,
  inboxRowSchema,
  type DecideResult,
  type DuoCandidate,
  type DuoInboxItem,
  type GroupMessage,
  type GroupMessageRow,
  type MyDuo,
} from './types'

const uuid = z.uuid()

export async function refreshMyDuo(): Promise<UserResult<MyDuo>> {
  if (!(await getViewer())) return fail('unauthorized')
  const duo = await getMyDuo()
  return duo ? ok(duo) : fail('generic')
}

// Invite a friend found by @username (userId), or create an invite link (null).
export async function inviteToDuo(
  userId: string | null,
): Promise<UserResult<{ teamId: string; code: string | null }>> {
  if (userId !== null && !uuid.safeParse(userId).success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('duo_invite', userId ? { p_user: userId } : {})
  if (error) return fail(error.code === 'P0002' ? 'notFound' : duoErrorKey(error.code))
  const result = z.object({ team_id: z.uuid(), code: z.string().nullable() }).safeParse(data)
  if (!result.success) return fail('generic')
  if (userId) notifyDuoInvite(userId, viewer.profile?.displayName ?? '')
  return ok({ teamId: result.data.team_id, code: result.data.code })
}

export async function acceptDuo(
  input: { teamId: string } | { code: string },
): Promise<UserResult<string>> {
  if (!(await getViewer())) return fail('unauthorized')
  const args =
    'teamId' in input
      ? uuid.safeParse(input.teamId).success
        ? { p_team: input.teamId }
        : null
      : INVITE_CODE_RE.test(input.code.trim().toLowerCase())
        ? { p_code: input.code.trim().toLowerCase() }
        : null
  if (!args) return fail('duoInviteInvalid')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('duo_accept', args)
  if (error || !data) return fail(duoErrorKey(error?.code))
  return ok(data)
}

export async function declineDuo(teamId: string): Promise<UserResult> {
  if (!uuid.safeParse(teamId).success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('duo_decline', { p_team: teamId })
  return error ? fail(duoErrorKey(error.code)) : ok(undefined)
}

// Leaves the active duo (it ends for both) or cancels the caller's pending invite.
export async function leaveDuo(): Promise<UserResult> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('duo_leave')
  return error ? fail(duoErrorKey(error.code)) : ok(undefined)
}

const profileSchema = z
  .object({
    bio: z.string().max(400),
    minAge: z.number().int().min(AGE_MIN).max(AGE_MAX),
    maxAge: z.number().int().min(AGE_MIN).max(AGE_MAX),
    maxKm: z.number().int().min(1).max(DISTANCE_MAX_KM),
  })
  .refine((v) => v.minAge <= v.maxAge)

// Returns whether the bio was held for review by the risk detector.
export async function saveDuoProfile(
  input: z.input<typeof profileSchema>,
): Promise<UserResult<{ held: boolean }>> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const bio = sanitizeText(parsed.data.bio).trim()
  if (bio.length > DUO_BIO_MAX) return fail('duoBioTooLong')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('duo_set_profile', {
    p_bio: bio,
    p_min_age: parsed.data.minAge,
    p_max_age: parsed.data.maxAge,
    p_max_km: parsed.data.maxKm,
  })
  if (error) return fail(duoErrorKey(error.code))
  return ok({ held: data === 'held' })
}

export async function loadDuoCandidates(): Promise<UserResult<DuoCandidate[]>> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_duo_candidates', { p_limit: 20 })
  if (error) return fail(duoErrorKey(error.code))
  const rows = z.array(candidateRowSchema).catch([]).parse(data)
  const people = await toPeople(rows.flatMap((r) => r.members))
  const byId = new Map(people.map((p) => [p.id, stripRow(p)]))
  return ok(
    rows.map((r) => ({
      teamId: r.team_id,
      bio: r.bio,
      distanceKm: r.distance_km,
      members: r.members.flatMap((m) => byId.get(m.id) ?? []),
    })),
  )
}

const decideSchema = z.object({ teamId: z.uuid(), like: z.boolean() })

export async function decideDuo(
  input: z.input<typeof decideSchema>,
): Promise<UserResult<DecideResult>> {
  const parsed = decideSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('duo_decide', {
    p_team: parsed.data.teamId,
    p_like: parsed.data.like,
  })
  if (error) return fail(duoErrorKey(error.code))
  const result = z
    .object({
      matched: z.boolean(),
      group_id: z.uuid().nullable(),
      just_matched: z.boolean().optional(),
      decided: z.string().optional(),
    })
    .safeParse(data)
  if (!result.success) return fail('generic')
  const { matched, group_id: groupId, just_matched: justMatched = false, decided } = result.data
  // A fresh like (not a repeat) is shown to the partner; a fresh match to the three others.
  if (parsed.data.like && !decided && !matched) {
    notifyDuoPartnerLiked(viewer.id, viewer.profile?.displayName ?? '')
  }
  if (justMatched && groupId) notifyDuoMatch(groupId, viewer.id)
  return ok({ matched, groupId, justMatched })
}

export async function undoDuoLike(teamId: string): Promise<UserResult<boolean>> {
  if (!uuid.safeParse(teamId).success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('duo_undo_like', { p_team: teamId })
  if (error) return fail(duoErrorKey(error.code))
  return data ? ok(true) : fail('duoUndoExpired')
}

export async function loadDuoInbox(): Promise<UserResult<DuoInboxItem[]>> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_duo_inbox')
  if (error) return fail(duoErrorKey(error.code))
  const rows = z.array(inboxRowSchema).catch([]).parse(data)
  const people = await toPeople(rows.flatMap((r) => r.team.members))
  const byId = new Map(people.map((p) => [p.id, stripRow(p)]))
  return ok(
    rows.map((r) => ({
      teamId: r.target_team_id,
      byName: r.by.display_name,
      mine: r.mine,
      createdAt: r.created_at,
      canUndo: r.can_undo,
      matched: r.matched,
      groupId: r.group_id,
      members: r.team.members.flatMap((m) => byId.get(m.id) ?? []),
    })),
  )
}

// ---------- group chats ----------

const sendSchema = z.union([
  z.object({ groupId: z.uuid(), body: z.string().trim().min(1).max(2000) }),
  z.object({
    groupId: z.uuid(),
    image: z.object({
      path: z.string().max(200),
      width: z.number().int().positive().max(20_000),
      height: z.number().int().positive().max(20_000),
    }),
  }),
])

// Inserted with the caller's client: RLS (current member, verified) and the triggers (membership,
// uploaded photo, rate limit, mute, risk flags) decide.
export async function sendGroupMessage(
  input: z.input<typeof sendSchema>,
): Promise<UserResult<GroupMessage>> {
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const { groupId } = parsed.data
  let row: {
    group_id: string
    kind: 'text' | 'image'
    body?: string
    media_path?: string
    image_width?: number
    image_height?: number
  }
  if ('body' in parsed.data) {
    const body = sanitizeText(parsed.data.body).trim()
    if (!body) return fail('invalidInput')
    row = { group_id: groupId, kind: 'text', body }
  } else {
    const { path, width, height } = parsed.data.image
    if (!path.startsWith(`${groupId}/`)) return fail('invalidInput')
    row = {
      group_id: groupId,
      kind: 'image',
      media_path: path,
      image_width: width,
      image_height: height,
    }
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('group_messages')
    .insert(row)
    .select(GROUP_MESSAGE_COLUMNS)
    .single()
  if (error || !data) return fail(groupSendErrorKey(error?.code))
  const [message] = await hydrateGroupMessages(supabase, [data as GroupMessageRow])
  if (!message) return fail('generic')
  notifyGroupMessage(groupId, viewer.id, message.kind === 'image' ? 'image' : 'text')
  return ok(message)
}

export async function loadGroupMessagesBefore(input: {
  groupId: string
  before: string
}): Promise<UserResult<{ messages: GroupMessage[]; hasMore: boolean }>> {
  const parsed = z
    .object({ groupId: z.uuid(), before: z.iso.datetime({ offset: true }) })
    .safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  return ok(await loadGroupPage(supabase, parsed.data.groupId, parsed.data.before))
}

// Messages after `after` (realtime resync after a reconnect), oldest first.
export async function loadGroupMessagesAfter(input: {
  groupId: string
  after: string
}): Promise<UserResult<GroupMessage[]>> {
  const parsed = z
    .object({ groupId: z.uuid(), after: z.iso.datetime({ offset: true }) })
    .safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data } = await supabase
    .from('group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('group_id', parsed.data.groupId)
    .gt('created_at', parsed.data.after)
    .order('created_at')
    .limit(200)
  return ok(await hydrateGroupMessages(supabase, (data ?? []) as GroupMessageRow[]))
}

// One realtime row → message with a signed photo URL.
export async function hydrateGroupRow(row: GroupMessageRow): Promise<UserResult<GroupMessage>> {
  if (!uuid.safeParse(row.id).success || !uuid.safeParse(row.group_id).success) {
    return fail('invalidInput')
  }
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  // Re-read through RLS instead of trusting the client's copy.
  const { data } = await supabase
    .from('group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('id', row.id)
    .maybeSingle()
  if (!data) return fail('notFound')
  const [message] = await hydrateGroupMessages(supabase, [data as GroupMessageRow])
  return message ? ok(message) : fail('generic')
}

export async function markGroupRead(groupId: string): Promise<UserResult> {
  if (!uuid.safeParse(groupId).success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('group_mark_read', { p_group: groupId })
  return error ? fail('generic') : ok(undefined)
}

export async function leaveGroup(groupId: string): Promise<UserResult> {
  if (!uuid.safeParse(groupId).success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('group_leave', { p_group: groupId })
  return error ? fail('generic') : ok(undefined)
}
