import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type LogEntry = {
  id: string
  action: string
  targetType: string
  targetId: string
  reason: string | null
  adminName: string
  createdAt: string
}

export async function getModerationLog(limit = 200): Promise<LogEntry[]> {
  await requireAdmin()
  const db = createAdminClient()
  const { data } = await db
    .from('moderation_actions')
    .select('id, action, target_type, target_id, reason, admin_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data?.length) return []

  // Moderators may have no dating profile, so names are best-effort.
  const adminIds = [...new Set(data.flatMap((d) => (d.admin_id ? [d.admin_id] : [])))]
  const { data: profiles } = await db.from('profiles').select('id, display_name').in('id', adminIds)
  const names = new Map(profiles?.map((p) => [p.id, p.display_name]))

  return data.map((d) => ({
    id: d.id,
    action: d.action,
    targetType: d.target_type,
    targetId: d.target_id,
    reason: d.reason,
    adminName: d.admin_id
      ? (names.get(d.admin_id) ?? d.admin_id.slice(0, 8))
      : d.action.startsWith('auto.')
        ? 'Система'
        : 'удалён',
    createdAt: d.created_at,
  }))
}
