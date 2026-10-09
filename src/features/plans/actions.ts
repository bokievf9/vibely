'use server'

import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { planFail } from './errors'

// Boost: shown first in Discover for 30 minutes (activate_boost, 20261009000280). A quota per
// plan (Plus 1 per month, VIP 1 per week); a running boost is returned as is. Returns its end.
export async function activateBoost(): Promise<UserResult<string>> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('activate_boost')
  if (error || !data) return planFail(error) ?? fail('generic')
  return ok(data)
}
