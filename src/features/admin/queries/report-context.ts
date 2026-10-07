import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/types/database.types'

type Target = {
  targetType: Enums<'report_target'>
  targetId: string
  reasons: { reporterId: string }[]
}
type Person = { id: string; name: string }

// What the moderator needs to judge a report, and whom a ban would hit (`offender`).
export type ReportContext =
  | { kind: 'user'; offender: Person; bio: string | null; banned: boolean }
  | { kind: 'post'; offender: Person; body: string; hidden: boolean }
  | { kind: 'comment'; offender: Person; body: string; postId: string; hidden: boolean }
  | {
      kind: 'random_session'
      offender: Person | null
      transcript: { from: string; body: string; at: string }[]
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

  const [users, posts, comments, sessions] = await Promise.all([
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
  ])

  users.data?.forEach((u) =>
    out.set(`user:${u.id}`, {
      kind: 'user',
      offender: person(u.id, u),
      bio: u.bio,
      banned: Boolean(u.banned_at),
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

  for (const s of sessions.data ?? []) {
    const target = targets.find((t) => t.targetId === s.id)
    const reporters = new Set(target?.reasons.map((r) => r.reporterId))
    const offenderId = [s.user_a, s.user_b].find((u) => !reporters.has(u)) ?? null
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
      transcript: (messages ?? []).map((m) => ({
        from: names.get(m.sender_id) ?? '—',
        body: m.body,
        at: m.created_at,
      })),
    })
  }
  return out
}
