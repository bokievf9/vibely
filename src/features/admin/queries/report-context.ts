import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/types/database.types'
import { getAdmin } from '../guard'
import { logAccess } from './access'
import { getCallsBetween, getCallsByIds, type ReportCall } from './call-recordings'
import { signUrls } from './storage'

type Target = {
  targetType: Enums<'report_target'>
  targetId: string
  // reports.subject_id: the reported person (group reports: target_id is not a user id).
  subjectId?: string | null
  reasons: { reporterId: string }[]
}
type Person = { id: string; name: string }

const likeNoteSchema = z.object({
  sender_id: z.string(),
  body: z.string(),
  state: z.string(),
  created_at: z.string(),
})

// What the moderator needs to judge a report, and whom a ban would hit (`offender`).
export type ReportContext =
  | { kind: 'user'; offender: Person; bio: string | null; banned: boolean; calls: ReportCall[] }
  | { kind: 'post'; offender: Person; body: string; hidden: boolean }
  | { kind: 'comment'; offender: Person; body: string; postId: string; hidden: boolean }
  | {
      kind: 'random_session'
      offender: Person | null
      transcript: { from: string; body: string; at: string }[]
    }
  // The message text itself is shown only in the logged transcript viewer (evidence-actions).
  | {
      kind: 'message'
      offender: Person
      mediaKind: string | null
      sentAt: string
      deleted: boolean
      calls: ReportCall[]
    }
  | { kind: 'photo'; offender: Person; url: string | null; width: number; height: number }
  | { kind: 'call'; offender: Person; call: ReportCall | null; calls: ReportCall[] }
  // Duo Dating group chats: text only in the logged group transcript viewer (evidence-actions).
  | { kind: 'group_message'; offender: Person; image: boolean; sentAt: string }
  | { kind: 'group_member'; offender: Person; leftAt: string | null; leftReason: string | null }
  | {
      kind: 'status'
      offender: Person
      emoji: string
      text: string
      state: string
      expiresAt: string
    }
  // A note attached to a like (20261009000290). The text is read through admin_open_like_note,
  // which checks the moderator role and the open report and logs every opening.
  | {
      kind: 'like_note'
      offender: Person
      body: string | null
      state: string
      sentAt: string
    }

const ids = (targets: Target[], type: Target['targetType']) =>
  targets.filter((t) => t.targetType === type).map((t) => t.targetId)

export async function getReportContexts(targets: Target[]): Promise<Map<string, ReportContext>> {
  const db = createAdminClient()
  const out = new Map<string, ReportContext>()
  const person = (id: string, p: { display_name: string } | null): Person => ({
    id,
    name: p?.display_name ?? '—',
  })

  const [
    users,
    posts,
    comments,
    sessions,
    messages,
    archived,
    photos,
    callRows,
    groupMessages,
    groupMembers,
    statuses,
  ] = await Promise.all([
    db.from('profiles').select('id, display_name, bio, banned_at').in('id', ids(targets, 'user')),
    db
      .from('posts')
      .select('id, body, is_hidden, author_id, profiles(display_name)')
      .in('id', ids(targets, 'post')),
    db
      .from('comments')
      .select('id, body, is_hidden, post_id, author_id, profiles(display_name)')
      .in('id', ids(targets, 'comment')),
    db
      .from('random_chat_sessions')
      .select('id, user_a, user_b')
      .in('id', ids(targets, 'random_session')),
    db
      .from('messages')
      .select('id, sender_id, media_kind, created_at, deleted_at')
      .in('id', ids(targets, 'message')),
    db
      .from('message_deletions')
      .select('message_id, sender_id, media_kind, sent_at')
      .in('message_id', ids(targets, 'message')),
    db
      .from('profile_photos')
      .select('id, profile_id, storage_path, width, height, profiles(display_name)')
      .in('id', ids(targets, 'photo')),
    getCallsByIds(ids(targets, 'call')),
    // Metadata only (no body): the text is read in the logged transcript viewer.
    ids(targets, 'group_message').length
      ? db
          .from('group_messages')
          .select('id, sender_id, kind, created_at')
          .in('id', ids(targets, 'group_message'))
      : { data: [] },
    ids(targets, 'group_member').length
      ? db
          .from('group_members')
          .select('id, user_id, left_at, left_reason')
          .in('id', ids(targets, 'group_member'))
      : { data: [] },
    // Live statuses (20261009000271); an error (table missing) just means no context.
    db
      .from('user_statuses')
      .select('id, user_id, emoji, text, moderation_state, expires_at, profiles(display_name)')
      .in('id', ids(targets, 'status')),
  ])

  // Calls between the reported user and the reporters (recordings: see call-recordings.ts).
  const userCalls = await Promise.all(
    (users.data ?? []).map((u) => {
      const target = targets.find((t) => t.targetType === 'user' && t.targetId === u.id)
      return getCallsBetween(u.id, target?.reasons.map((r) => r.reporterId) ?? [])
    }),
  )
  users.data?.forEach((u, i) =>
    out.set(`user:${u.id}`, {
      kind: 'user',
      offender: person(u.id, u),
      bio: u.bio,
      banned: Boolean(u.banned_at),
      calls: userCalls[i] ?? [],
    }),
  )
  posts.data?.forEach((p) =>
    out.set(`post:${p.id}`, {
      kind: 'post',
      offender: person(p.author_id, p.profiles),
      body: p.body,
      hidden: p.is_hidden,
    }),
  )
  comments.data?.forEach((c) =>
    out.set(`comment:${c.id}`, {
      kind: 'comment',
      offender: person(c.author_id, c.profiles),
      body: c.body,
      postId: c.post_id,
      hidden: c.is_hidden,
    }),
  )

  // Messages, photos and calls: the reported person is the case subject.
  const subjectIds = new Set<string>()
  messages.data?.forEach((m) => subjectIds.add(m.sender_id))
  archived.data?.forEach((m) => subjectIds.add(m.sender_id))
  callRows.forEach((c) => c.parties.forEach((p) => subjectIds.add(p)))
  // Group reports: the reported person is reports.subject_id (fallback: sender or member).
  const subjectOf = (type: Target['targetType'], id: string) =>
    targets.find((t) => t.targetType === type && t.targetId === id)?.subjectId ?? null
  const groupSubjects = new Map<string, string>()
  groupMessages.data?.forEach((m) => {
    const subject = subjectOf('group_message', m.id) ?? m.sender_id
    if (subject) groupSubjects.set(`group_message:${m.id}`, subject)
  })
  groupMembers.data?.forEach((m) =>
    groupSubjects.set(`group_member:${m.id}`, subjectOf('group_member', m.id) ?? m.user_id),
  )
  groupSubjects.forEach((id) => subjectIds.add(id))
  const { data: subjectProfiles } = subjectIds.size
    ? await db
        .from('profiles')
        .select('id, display_name')
        .in('id', [...subjectIds])
    : { data: [] }
  const nameOf = (id: string) => ({
    id,
    name: subjectProfiles?.find((p) => p.id === id)?.display_name ?? '—',
  })
  const reportersOf = (type: Target['targetType'], id: string) =>
    targets
      .find((t) => t.targetType === type && t.targetId === id)
      ?.reasons.map((r) => r.reporterId) ?? []

  for (const id of ids(targets, 'message')) {
    const live = messages.data?.find((m) => m.id === id)
    const gone = archived.data?.find((m) => m.message_id === id)
    const senderId = live?.sender_id ?? gone?.sender_id
    if (!senderId) continue
    out.set(`message:${id}`, {
      kind: 'message',
      offender: nameOf(senderId),
      mediaKind: gone?.media_kind ?? live?.media_kind ?? null,
      sentAt: live?.created_at ?? gone?.sent_at ?? '',
      deleted: Boolean(live?.deleted_at) || (!live && !!gone),
      calls: await getCallsBetween(senderId, reportersOf('message', id)),
    })
  }

  const photoUrls = await signUrls('profile-photos', photos.data?.map((p) => p.storage_path) ?? [])
  photos.data?.forEach((p) =>
    out.set(`photo:${p.id}`, {
      kind: 'photo',
      offender: person(p.profile_id, p.profiles),
      url: photoUrls.get(p.storage_path) ?? null,
      width: p.width,
      height: p.height,
    }),
  )

  for (const id of ids(targets, 'call')) {
    const call = callRows.find((c) => c.call.id === id)
    if (!call) continue
    const reporters = reportersOf('call', id)
    const offenderId = call.parties.find((p) => !reporters.includes(p))
    if (!offenderId) continue
    out.set(`call:${id}`, {
      kind: 'call',
      offender: nameOf(offenderId),
      call: call.call,
      calls: (await getCallsBetween(offenderId, reporters)).filter((c) => c.id !== id),
    })
  }

  groupMessages.data?.forEach((m) => {
    const subject = groupSubjects.get(`group_message:${m.id}`)
    if (!subject) return
    out.set(`group_message:${m.id}`, {
      kind: 'group_message',
      offender: nameOf(subject),
      image: m.kind === 'image',
      sentAt: m.created_at,
    })
  })
  groupMembers.data?.forEach((m) => {
    const subject = groupSubjects.get(`group_member:${m.id}`)
    if (!subject) return
    out.set(`group_member:${m.id}`, {
      kind: 'group_member',
      offender: nameOf(subject),
      leftAt: m.left_at,
      leftReason: m.left_reason,
    })
  })
  statuses.data?.forEach((s) =>
    out.set(`status:${s.id}`, {
      kind: 'status',
      offender: person(s.user_id, s.profiles),
      emoji: s.emoji,
      text: s.text,
      state: s.moderation_state,
      expiresAt: s.expires_at,
    }),
  )

  const noteIds = ids(targets, 'like_note')
  if (noteIds.length) {
    const admin = await getAdmin()
    const notes = await Promise.all(
      noteIds.map((id) =>
        db
          .rpc('admin_open_like_note', { p_admin: admin.id, p_note: id })
          .then(({ data, error }) => (error ? null : likeNoteSchema.safeParse(data).data)),
      ),
    )
    const senders = notes.flatMap((n) => (n ? [n.sender_id] : []))
    const { data: senderProfiles } = senders.length
      ? await db.from('profiles').select('id, display_name').in('id', senders)
      : { data: [] }
    notes.forEach((n, i) => {
      const id = noteIds[i]
      if (!n || !id) return
      out.set(`like_note:${id}`, {
        kind: 'like_note',
        offender: person(n.sender_id, senderProfiles?.find((p) => p.id === n.sender_id) ?? null),
        body: n.body,
        state: n.state,
        sentAt: n.created_at,
      })
    })
  }

  for (const s of sessions.data ?? []) {
    const target = targets.find((t) => t.targetId === s.id)
    const reporters = new Set(target?.reasons.map((r) => r.reporterId))
    const offenderId = [s.user_a, s.user_b].find((u) => !reporters.has(u)) ?? null
    // The transcript is shown only after the view is logged (moderators; CLAUDE.md protocol).
    const canRead = await logAccess(
      'view.transcript',
      'random_session',
      [s.id],
      'Жалоба на блайнд-дейт',
    )
    const { data: messages } = await db
      .from('random_chat_messages')
      .select('body, created_at, sender_id, profiles(display_name)')
      .eq('session_id', s.id)
      .order('created_at')
      .limit(300)
    const names = new Map(messages?.map((m) => [m.sender_id, m.profiles?.display_name ?? '—']))
    out.set(`random_session:${s.id}`, {
      kind: 'random_session',
      offender: offenderId ? { id: offenderId, name: names.get(offenderId) ?? '—' } : null,
      transcript: (canRead ? (messages ?? []) : []).map((m) => ({
        from: names.get(m.sender_id) ?? '—',
        body: m.body,
        at: m.created_at,
      })),
    })
  }
  return out
}
