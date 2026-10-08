import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type TrendDay = {
  day: string
  reports_opened: number
  reports_resolved: number
  verifications: number
  bans: number
}

export type ModeratorThroughput = {
  admin_id: string
  name: string | null
  total: number
  reports: number
  verifications: number
  sanctions: number
}

export type Trends = {
  days: number
  series: TrendDay[]
  medianResolveHours: number | null
  moderators: ModeratorThroughput[]
}

// admin_stats (20261009000154): daily counts in Malaysia time, median time to resolve a report,
// and what each moderator did in the period.
export async function getTrends(days: 7 | 30): Promise<Trends> {
  const adminId = await requireAdmin()
  const { data } = await createAdminClient().rpc('admin_stats', { p_admin: adminId, p_days: days })
  const raw = (data ?? {}) as {
    series?: TrendDay[]
    median_resolve_hours?: number | null
    moderators?: ModeratorThroughput[]
  }
  return {
    days,
    series: raw.series ?? [],
    medianResolveHours: raw.median_resolve_hours ?? null,
    moderators: raw.moderators ?? [],
  }
}
