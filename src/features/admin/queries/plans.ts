import 'server-only'
import type { Json } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { LIMIT_PERIODS, PLAN_LEVELS, type LimitPeriod, type PlanLevel } from '../plans-schemas'

export type PlanLimit = { limit: number | null; period: LimitPeriod | null }

export type PlanFeature = {
  key: string
  nameRu: string
  minPlan: PlanLevel
  enabled: boolean
  note: string | null
  // Only the plans that have a row in plan_limits.
  limits: Partial<Record<PlanLevel, PlanLimit>>
}

export type PlanStats = {
  byPlan: Record<PlanLevel, number>
  staff: number
  bySource: { source: string; active: number; total: number; last30d: number }[]
}

type Obj = { [key: string]: Json | undefined }
const obj = (v: Json | undefined): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const num = (v: Json | undefined) => (typeof v === 'number' ? v : Number(v ?? 0) || 0)
const str = (v: Json | undefined) => (typeof v === 'string' ? v : null)
const asPlan = (v: Json | undefined): PlanLevel => PLAN_LEVELS.find((p) => p === v) ?? 'free'
const asPeriod = (v: Json | undefined): LimitPeriod | null =>
  LIMIT_PERIODS.find((p) => p === v) ?? null

// The matrix, or null when the RPC is not deployed yet (20261009000280 pending).
export async function getPlanMatrix(): Promise<PlanFeature[] | null> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data, error } = await createAdminClient().rpc('admin_plan_matrix', { p_admin: adminId })
  if (error || !Array.isArray(data)) return null
  return data.map((row) => {
    const f = obj(row)
    const limits: PlanFeature['limits'] = {}
    for (const [plan, l] of Object.entries(obj(f.limits))) {
      const o = obj(l)
      limits[asPlan(plan)] = {
        limit: typeof o.limit === 'number' ? o.limit : null,
        period: asPeriod(o.period),
      }
    }
    return {
      key: str(f.key) ?? '',
      nameRu: str(f.name_ru) ?? '',
      minPlan: asPlan(f.min_plan),
      enabled: f.enabled === true,
      note: str(f.note),
      limits,
    }
  })
}

export async function getPlanStats(): Promise<PlanStats | null> {
  const adminId = await requireAdmin({ min: 'admin' })
  const { data, error } = await createAdminClient().rpc('admin_plan_stats', { p_admin: adminId })
  if (error) return null
  const s = obj(data)
  const byPlan = obj(s.by_plan)
  return {
    byPlan: { free: num(byPlan.free), plus: num(byPlan.plus), vip: num(byPlan.vip) },
    staff: num(s.staff),
    bySource: (Array.isArray(s.by_source) ? s.by_source : []).map((r) => {
      const o = obj(r)
      return {
        source: str(o.source) ?? '',
        active: num(o.active),
        total: num(o.total),
        last30d: num(o.last_30d),
      }
    }),
  }
}
