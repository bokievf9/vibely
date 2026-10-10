import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

// Early access waitlist (20261009000300). Viewers and up see masked numbers and counts; full
// numbers only come through the logged CSV export (admin and owner, ../waitlist-actions.ts).

export const WAITLIST_STATUSES = ['all', 'pending', 'invited'] as const
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number]

export const waitlistFilterSchema = z.object({
  status: z.enum(WAITLIST_STATUSES).catch('pending'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export const WAITLIST_PAGE_SIZE = 100

export type WaitlistEntry = {
  id: string
  phoneMasked: string
  city: string | null
  locale: string
  source: string
  createdAt: string
  invitedAt: string | null
}

export type WaitlistStats = {
  total: number
  pending: number
  invited: number
  last24h: number
  last7d: number
  byCity: Record<string, number>
  byLocale: Record<string, number>
}

const statsSchema = z.object({
  total: z.number(),
  pending: z.number(),
  invited: z.number(),
  last_24h: z.number(),
  last_7d: z.number(),
  by_city: z.record(z.string(), z.number()),
  by_locale: z.record(z.string(), z.number()),
})

// Null while the migration is not applied: the page says so instead of failing.
export async function getWaitlistStats(): Promise<WaitlistStats | null> {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_waitlist_stats', {
    p_admin: adminId,
  })
  if (error) return null
  const parsed = statsSchema.safeParse(data)
  if (!parsed.success) return null
  const s = parsed.data
  return {
    total: s.total,
    pending: s.pending,
    invited: s.invited,
    last24h: s.last_24h,
    last7d: s.last_7d,
    byCity: s.by_city,
    byLocale: s.by_locale,
  }
}

export async function getWaitlistPage(
  status: WaitlistStatus,
  page: number,
): Promise<{ entries: WaitlistEntry[]; total: number } | null> {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_waitlist_list', {
    p_admin: adminId,
    p_status: status,
    p_limit: WAITLIST_PAGE_SIZE,
    p_offset: (page - 1) * WAITLIST_PAGE_SIZE,
  })
  if (error) return null
  return {
    total: Number(data[0]?.total ?? 0),
    entries: data.map((r) => ({
      id: r.id,
      phoneMasked: r.phone_masked,
      city: r.city,
      locale: r.locale,
      source: r.source,
      createdAt: r.created_at,
      invitedAt: r.invited_at,
    })),
  }
}
