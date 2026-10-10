import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FULL_ACCESS, isFeatureKey, parseAccess, type Access, type FeatureKey } from './access'
import { parseCatalog, type Catalog } from './comparison'

// The whole matrix (every plan's limits) for the Plans screen and the upgrade sheet. Both tables
// are readable by any signed-in user. Null when they are missing or unreadable: the screens then
// show the plan cards without the comparison.
export const getPlanCatalog = cache(async (): Promise<Catalog | null> => {
  const supabase = await createClient()
  const [features, limits] = await Promise.all([
    supabase.from('features').select('key, min_plan, enabled, sort'),
    supabase.from('plan_limits').select('feature_key, plan, limit_value, period'),
  ])
  if (features.error || limits.error || !features.data?.length) return null
  return parseCatalog(features.data, limits.data ?? [], isFeatureKey)
})

// Plans the viewer asked to be told about (plan_interest, 20261009000310). Empty when the table
// is not deployed yet.
export const getPlanInterest = cache(async (): Promise<('plus' | 'vip')[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('plan_interest').select('plan')
  if (error || !data) return []
  return data.map((r) => r.plan).filter((p): p is 'plus' | 'vip' => p === 'plus' || p === 'vip')
})

// The viewer's plan, staff flag and the matrix as it applies to them: one my_access() call per
// request (React cache). When the function is missing (migration 20261009000280 not applied) or
// fails, everything is allowed, as before plans existed.
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_access')
  if (error || data === null) return FULL_ACCESS
  return parseAccess(data)
})

// Another user's feature, for server jobs without their cookies (pushes): service role.
// True when the function is missing (same fallback as getAccess).
export async function userHasFeature(userId: string, key: FeatureKey): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('has_feature', {
    p_user: userId,
    p_key: key,
  })
  return error ? true : data === true
}
