'use server'

import { isAuthWeakPasswordError } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { requestOtp } from './otp'
import { hasRecentOtp, maskPhone, passwordError } from './password'
import { otpSchema } from './schemas'
import { getViewer } from './session'

// Settings → Sign-in password. Setting or changing the password needs a session signed in with an
// SMS code within the last 10 minutes (hasRecentOtp on the JWT `amr` claim). Otherwise the user
// confirms with a fresh code first (sendPasswordCode + verifyPasswordCode), which is a normal
// Supabase phone OTP sign-in for the same account and gives a brand-new session. That also
// satisfies Supabase's "Secure password change" (recent session) when it is turned on.

async function signedIn() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub || !claims.phone) return null
  return { supabase, claims, phone: `+${claims.phone.replace(/\D/g, '')}` }
}

export type PasswordStep = { needsCode: boolean; phone: string }

// Opening the sheet: is an SMS code needed first, and where would it go.
export async function beginPasswordChange(): Promise<UserResult<PasswordStep>> {
  const session = await signedIn()
  if (!session) return fail('unauthorized')
  return ok({ needsCode: !hasRecentOtp(session.claims.amr), phone: maskPhone(session.phone) })
}

export async function sendPasswordCode(captchaToken?: string): Promise<UserResult> {
  const session = await signedIn()
  if (!session) return fail('unauthorized')
  const error = await requestOtp(session.phone, captchaToken, { existingOnly: true })
  return error ? fail(error) : ok(undefined)
}

export async function verifyPasswordCode(token: string): Promise<UserResult> {
  const parsed = otpSchema.safeParse({ token })
  if (!parsed.success) return fail('otpFormat')
  const session = await signedIn()
  if (!session) return fail('unauthorized')
  const { data, error } = await session.supabase.auth.verifyOtp({
    phone: session.phone,
    token: parsed.data.token,
    type: 'sms',
  })
  if (error) return fail('otpInvalid')
  // The phone is unique, so this is the same account; refuse anything else outright.
  if (data.user?.id !== session.claims.sub) {
    await session.supabase.auth.signOut()
    return fail('unauthorized')
  }
  return ok(undefined)
}

const saveSchema = z.object({ password: z.string().max(256), repeat: z.string().max(256) })

export async function savePassword(input: {
  password: string
  repeat: string
}): Promise<UserResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const [session, viewer] = await Promise.all([signedIn(), getViewer()])
  if (!session || !viewer?.profile) return fail('unauthorized')
  if (!hasRecentOtp(session.claims.amr)) return fail('passwordReauth')

  const { password, repeat } = parsed.data
  const rule = passwordError(password, { username: viewer.profile.username, phone: session.phone })
  if (rule) return fail(rule)
  if (password !== repeat) return fail('passwordMismatch')

  const { error } = await session.supabase.auth.updateUser({ password })
  if (error) {
    if (isAuthWeakPasswordError(error))
      return fail(error.reasons.includes('pwned') ? 'passwordPwned' : 'passwordWeak')
    if (error.code === 'same_password') return fail('passwordSame')
    if (error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid')
      return fail('passwordReauth')
    if (error.status === 429) return fail('rateLimited')
    return fail('generic')
  }
  // Whoever might have known the old password loses their sessions.
  await session.supabase.auth.signOut({ scope: 'others' })
  return ok(undefined)
}

export async function removePassword(): Promise<UserResult> {
  const session = await signedIn()
  if (!session) return fail('unauthorized')
  const { error } = await session.supabase.rpc('remove_my_password')
  if (error) return fail('generic')
  await session.supabase.auth.signOut({ scope: 'others' })
  return ok(undefined)
}
