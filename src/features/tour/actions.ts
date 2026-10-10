'use server'

import { getViewer } from '@/features/auth/session'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { createClient } from '@/lib/supabase/server'
import { TIP_KEYS, TOUR_STEPS, type TipKey } from './steps'

// Both return whether the server stored it: false before migration 20261010000200, when the
// device's localStorage record is all there is. The client never shows an error for these.

export async function saveTourEnd(
  event: 'complete' | 'skip',
  step?: number,
): Promise<UserResult<boolean>> {
  if (event !== 'complete' && event !== 'skip') return fail('invalidInput')
  const at =
    event === 'skip' && Number.isInteger(step) && step! >= 0 && step! < TOUR_STEPS.length
      ? step
      : undefined
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('tour_mark', { p_event: event, p_step: at })
  return ok(!error)
}

export async function saveTipSeen(key: TipKey): Promise<UserResult<boolean>> {
  if (!TIP_KEYS.includes(key)) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('tour_tip_seen', { p_key: key })
  return ok(!error)
}
