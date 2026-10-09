'use server'

import { fail, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { redeemForViewer } from './redeem'
import { redeemSchema, type PromoOutcome } from './schemas'

// Settings → Promo code. The onboarding field goes through createProfile() instead.
export async function redeemPromo(input: { code: string }): Promise<UserResult<PromoOutcome>> {
  const parsed = redeemSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const viewer = await getViewer()
  if (!viewer?.profile) return fail('unauthorized')
  return redeemForViewer(parsed.data.code)
}
