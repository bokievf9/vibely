'use server'

import { createClient } from '@/lib/supabase/server'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { planTagSchema, type OwnPlan } from './tags'

// One active plan per user; set_plan() replaces the previous one and restarts the 24 hours.
export async function setPlan(tag: string): Promise<UserResult<OwnPlan>> {
  const parsed = planTagSchema.safeParse(tag)
  if (!parsed.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_plan', { p_tag: parsed.data })
  if (error)
    return fail(error.code === '42501' ? 'unauthorized' : rateLimitedOr(error.code, 'generic'))
  return ok({ tag: parsed.data, expiresAt: data })
}

export async function clearPlan(): Promise<UserResult> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('clear_plan')
  return error ? fail('generic') : ok(undefined)
}
