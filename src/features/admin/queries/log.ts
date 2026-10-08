import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type LogEntry = {
  id: string
  action: string
  targetType: string
  targetId: string
  reason: string | null
  adminId: string | null
  adminName: string
  createdAt: string
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// Journal filters from the URL (?admin=&action=&target=&from=&to=&page=). Invalid values are
// dropped instead of failing the page.
export const logFilterSchema = z.object({
  admin: z.uuid().optional().catch(undefined),
  action: z
    .string()
    .regex(/^[a-z_.]{2,40}$/)
    .optional()
    .catch(undefined),
  target: z.uuid().optional().catch(undefined),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type LogFilters = z.output<typeof logFilterSchema>

export const LOG_PAGE_SIZE = 50
// The CSV export is capped: a bigger range has to be split.
export const LOG_EXPORT_MAX = 5000

// Malaysia time, like everything else in the panel.
const startOf = (d: string) => `${d}T00:00:00+08:00`
const endOf = (d: string) => `${d}T23:59:59.999+08:00`

function filtered(f: LogFilters) {
  let q = createAdminClient()
    .from('moderation_actions')
    .select('id, action, target_type, target_id, reason, admin_id, created_at', { count: 'exact' })
  if (f.admin) q = q.eq('admin_id', f.admin)
  if (f.action) q = q.eq('action', f.action)
  if (f.target) q = q.eq('target_id', f.target)
  if (f.from) q = q.gte('created_at', startOf(f.from))
  if (f.to) q = q.lte('created_at', endOf(f.to))
  return q.order('created_at', { ascending: false })
}

// Moderators may have no dating profile, so names are best-effort.
export async function adminNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
  return new Map(data?.map((p) => [p.id, p.display_name]))
}

async function toEntries(
  rows: {
    id: string
    action: string
    target_type: string
    target_id: string
    reason: string | null
    admin_id: string | null
    created_at: string
  }[],
): Promise<LogEntry[]> {
  const names = await adminNames([
    ...new Set(rows.flatMap((d) => (d.admin_id ? [d.admin_id] : []))),
  ])
  return rows.map((d) => ({
    id: d.id,
    action: d.action,
    targetType: d.target_type,
    targetId: d.target_id,
    reason: d.reason,
    adminId: d.admin_id,
    adminName: d.admin_id
      ? (names.get(d.admin_id) ?? d.admin_id.slice(0, 8))
      : d.action.startsWith('auto.')
        ? 'Система'
        : 'удалён',
    createdAt: d.created_at,
  }))
}

export async function getModerationLog(
  filters: LogFilters = {},
): Promise<{ entries: LogEntry[]; total: number; page: number; pages: number }> {
  await requireAdmin()
  const page = filters.page ?? 1
  const from = (page - 1) * LOG_PAGE_SIZE
  const { data, count } = await filtered(filters).range(from, from + LOG_PAGE_SIZE - 1)
  const total = count ?? 0
  return {
    entries: await toEntries(data ?? []),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / LOG_PAGE_SIZE)),
  }
}

// For the CSV export (the caller checks the role and logs the export).
export async function getLogForExport(filters: LogFilters): Promise<LogEntry[]> {
  const { data } = await filtered(filters).range(0, LOG_EXPORT_MAX - 1)
  return toEntries(data ?? [])
}

// Panel members for the moderator filter.
export async function getTeamOptions(): Promise<{ id: string; name: string }[]> {
  await requireAdmin()
  const { data } = await createAdminClient().from('admins').select('user_id')
  const ids = data?.map((a) => a.user_id) ?? []
  const names = await adminNames(ids)
  return ids
    .map((id) => ({ id, name: names.get(id) ?? id.slice(0, 8) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
