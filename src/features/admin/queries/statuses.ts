import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export const STATUS_FILTERS = ['held', 'reported', 'recent'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]
export const STATUS_PAGE_SIZE = 30

export type AdminStatus = {
  id: string
  userId: string
  name: string
  username: string | null
  emoji: string
  text: string
  planTag: string | null
  state: 'visible' | 'held' | 'removed'
  heldKinds: string[]
  createdAt: string
  expiresAt: string
  replacedAt: string | null
  reviewedAt: string | null
  openReports: number
  banned: boolean
}

export type StatusQueue = { statuses: AdminStatus[]; total: number; available: boolean }

const asState = (s: string): AdminStatus['state'] =>
  s === 'held' || s === 'removed' ? s : 'visible'

// /admin/statuses (20261009000271): held statuses (risk detector), reported ones, or the last 7
// days. `available` is false until the migration is applied (the page explains instead).
export async function getStatusQueue(filter: StatusFilter, page: number): Promise<StatusQueue> {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_status_queue', {
    p_admin: adminId,
    p_filter: filter,
    p_limit: STATUS_PAGE_SIZE,
    p_offset: (page - 1) * STATUS_PAGE_SIZE,
  })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { statuses: [], total: 0, available: false }
    }
    throw new Error(`status queue: ${error.message}`)
  }
  const rows = data ?? []
  return {
    available: true,
    total: Number(rows[0]?.total ?? 0),
    statuses: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.display_name,
      username: r.username,
      emoji: r.emoji,
      text: r.text,
      planTag: r.plan_tag,
      state: asState(r.moderation_state),
      heldKinds: r.held_kinds ?? [],
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      replacedAt: r.replaced_at,
      reviewedAt: r.reviewed_at,
      openReports: r.open_reports,
      banned: r.banned,
    })),
  }
}
