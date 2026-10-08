import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { adminNames } from './log'

export type AppealRow = {
  id: string
  userId: string
  userName: string
  body: string
  status: string
  sanctionReason: string | null
  sanctionAt: string | null
  bannedUntil: string | null
  createdAt: string
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
}

// Open appeals oldest first; decided ones (?status=decided) newest first.
export async function getAppeals(decided: boolean): Promise<AppealRow[]> {
  await requireAdmin()
  let q = createAdminClient()
    .from('appeals')
    .select(
      'id, user_id, body, status, sanction_reason, sanction_at, created_at, decided_by, decided_at, decision_note, profiles(display_name, banned_until)',
    )
  q = decided
    ? q.neq('status', 'open').order('decided_at', { ascending: false })
    : q.eq('status', 'open').order('created_at')
  const { data } = await q.limit(100)
  const names = await adminNames([
    ...new Set((data ?? []).flatMap((a) => (a.decided_by ? [a.decided_by] : []))),
  ])
  return (data ?? []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    userName: a.profiles?.display_name ?? '—',
    body: a.body,
    status: a.status,
    sanctionReason: a.sanction_reason,
    sanctionAt: a.sanction_at,
    bannedUntil: a.profiles?.banned_until ?? null,
    createdAt: a.created_at,
    decidedBy: a.decided_by ? (names.get(a.decided_by) ?? a.decided_by.slice(0, 8)) : null,
    decidedAt: a.decided_at,
    decisionNote: a.decision_note,
  }))
}

export async function countOpenAppeals(): Promise<number> {
  await requireAdmin()
  const { count } = await createAdminClient()
    .from('appeals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
  return count ?? 0
}
