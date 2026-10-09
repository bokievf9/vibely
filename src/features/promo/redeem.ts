import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { outcomeFromResult, redeemResultSchema, type PromoOutcome } from './schemas'

// Calls redeem_promo() for the signed-in user (SECURITY DEFINER: the row lock, every limit and
// the 5-per-hour attempt counter live there). Shared by the Settings action and createProfile().
export async function redeemForViewer(code: string): Promise<UserResult<PromoOutcome>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('redeem_promo', { p_code: code })
  // PGRST202: the RPC is not deployed yet (migration pending). Reads as a generic failure.
  if (error) return fail(error.code === '42501' ? 'unauthorized' : 'generic')
  const result = redeemResultSchema.safeParse(data)
  if (!result.success) return fail('generic')
  const outcome = outcomeFromResult(result.data)
  return typeof outcome === 'string' ? fail(outcome) : ok(outcome)
}
