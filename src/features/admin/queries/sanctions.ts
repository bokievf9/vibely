import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { adminNames } from './log'

export type UserSanctions = {
  bannedUntil: string | null
  mutedUntil: string | null
  muteReason: string | null
  shadowBanned: boolean
  evidenceHold: { at: string; reason: string | null } | null
  phoneBlocked: { id: string; reason: string | null } | null
  warnings: {
    id: string
    reason: string
    note: string | null
    by: string
    createdAt: string
    expiresAt: string
    acknowledgedAt: string | null
    revokedAt: string | null
    active: boolean
  }[]
  notes: { id: string; body: string; authorId: string | null; author: string; createdAt: string }[]
  appeals: {
    id: string
    status: string
    body: string
    createdAt: string
    decisionNote: string | null
  }[]
}

export async function getUserSanctions(userId: string): Promise<UserSanctions | null> {
  await requireAdmin()
  const db = createAdminClient()
  const [profile, warnings, notes, appeals, blocked] = await Promise.all([
    db
      .from('profiles')
      .select(
        'banned_until, muted_until, mute_reason, shadow_banned, evidence_hold_at, evidence_hold_reason',
      )
      .eq('id', userId)
      .maybeSingle(),
    db
      .from('user_warnings')
      .select('id, reason, note, created_by, created_at, expires_at, acknowledged_at, revoked_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('user_notes')
      .select('id, body, author_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('appeals')
      .select('id, status, body, created_at, decision_note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('phone_blocklist').select('id, reason').eq('user_id', userId).limit(1).maybeSingle(),
  ])
  const p = profile.data
  if (!p) return null

  const names = await adminNames([
    ...new Set([
      ...(warnings.data ?? []).flatMap((w) => (w.created_by ? [w.created_by] : [])),
      ...(notes.data ?? []).flatMap((n) => (n.author_id ? [n.author_id] : [])),
    ]),
  ])
  const name = (id: string | null) => (id ? (names.get(id) ?? id.slice(0, 8)) : 'удалён')
  const now = Date.now()

  return {
    bannedUntil: p.banned_until,
    mutedUntil: p.muted_until && Date.parse(p.muted_until) > now ? p.muted_until : null,
    muteReason: p.mute_reason,
    shadowBanned: p.shadow_banned,
    evidenceHold: p.evidence_hold_at
      ? { at: p.evidence_hold_at, reason: p.evidence_hold_reason }
      : null,
    phoneBlocked: blocked.data ?? null,
    warnings: (warnings.data ?? []).map((w) => ({
      id: w.id,
      reason: w.reason,
      note: w.note,
      by: name(w.created_by),
      createdAt: w.created_at,
      expiresAt: w.expires_at,
      acknowledgedAt: w.acknowledged_at,
      revokedAt: w.revoked_at,
      active: !w.revoked_at && Date.parse(w.expires_at) > now,
    })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.author_id,
      author: name(n.author_id),
      createdAt: n.created_at,
    })),
    appeals: (appeals.data ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      body: a.body,
      createdAt: a.created_at,
      decisionNote: a.decision_note,
    })),
  }
}
