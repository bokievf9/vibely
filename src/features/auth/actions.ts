'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { localePath } from '@/i18n/config'
import { fail, ok, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getActionLocale } from '@/i18n/server'
import { otpSchema, phoneSchema } from './schemas'
import { PENDING_PHONE_COOKIE, getViewer, nextStepFor } from './session'

export type AuthFormState = UserResult<null> | null

export async function sendOtp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = phoneSchema.safeParse({ phone: formData.get('phone') })
  if (!parsed.success) return fail(zodErrorKey(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone })
  if (error) {
    // 403 comes from the Malaysia-only auth hook.
    if (error.status === 429) return fail('rateLimited')
    if (error.status === 403) return fail('phoneNotMalaysia')
    return fail('smsFailed')
  }

  const cookieStore = await cookies()
  cookieStore.set(PENDING_PHONE_COOKIE, parsed.data.phone, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  redirect(localePath(await getActionLocale(), '/verify-otp'))
}

export async function resendOtp(): Promise<UserResult> {
  const phone = (await cookies()).get(PENDING_PHONE_COOKIE)?.value
  if (!phone) return fail('sessionExpired')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) return fail(error.status === 429 ? 'rateLimited' : 'smsFailed')
  return ok(undefined)
}

export async function verifyOtp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = otpSchema.safeParse({ token: formData.get('token') })
  if (!parsed.success) return fail(zodErrorKey(parsed.error))

  const locale = await getActionLocale()
  const cookieStore = await cookies()
  const phone = cookieStore.get(PENDING_PHONE_COOKIE)?.value
  if (!phone) redirect(localePath(locale, '/login'))

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ phone, token: parsed.data.token, type: 'sms' })
  if (error) return fail('otpInvalid')

  cookieStore.delete(PENDING_PHONE_COOKIE)
  redirect(localePath(locale, nextStepFor(await getViewer())))
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(localePath(await getActionLocale(), '/login'))
}
