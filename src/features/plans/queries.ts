import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FULL_ACCESS, parseAccess, type Access, type FeatureKey } from './access'

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
