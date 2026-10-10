'use server'

import { createClient } from '@/lib/supabase/server'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import type { Catalog } from './comparison'
import { planFail } from './errors'
import { getPlanCatalog, getPlanInterest } from './queries'

// Boost: shown first in Discover for 30 minutes (activate_boost, 20261009000280). A quota per
// plan (Plus 1 per month, VIP 1 per week); a running boost is returned as is. Returns its end.
export async function activateBoost(): Promise<UserResult<string>> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('activate_boost')
  if (error || !data) return planFail(error) ?? fail('generic')
  return ok(data)
}

// What the upgrade sheet needs beyond my_access: every plan's limits (for the benefits and the
// Plus / VIP rows) and the plans the viewer already asked about. Loaded when the sheet first
// opens, so ordinary page loads do not pay for it.
export async function loadPaywall(): Promise<
  UserResult<{ catalog: Catalog | null; interest: ('plus' | 'vip')[] }>
> {
  if (!(await getViewer())) return fail('unauthorized')
  const [catalog, interest] = await Promise.all([getPlanCatalog(), getPlanInterest()])
  return ok({ catalog, interest })
}

// "Notify me when it launches" (register_plan_interest, 20261009000310). Returns true when this
// is the first tap for that plan. Before the migration is applied: `planInterestUnavailable`.
export async function registerPlanInterest(plan: 'plus' | 'vip'): Promise<UserResult<boolean>> {
  if (plan !== 'plus' && plan !== 'vip') return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_plan_interest', { p_plan: plan })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01')
      return fail('planInterestUnavailable')
    return fail(rateLimitedOr(error.code, 'generic'))
  }
  return ok(data === true)
}
