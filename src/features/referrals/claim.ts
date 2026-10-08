import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { parseRefCode, REF_COOKIE } from './constants'

// Right after sign-up (profile created): records who invited this user, then forgets the code.
// Best effort: a bad or unknown code never blocks onboarding.
export async function claimReferralFromCookie(): Promise<void> {
  const jar = await cookies()
  const code = parseRefCode(jar.get(REF_COOKIE)?.value)
  if (!jar.has(REF_COOKIE)) return
  jar.delete(REF_COOKIE)
  if (!code) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('claim_referral', { p_code: code })
  if (error) console.error('[referral] claim failed', error.message)
}
