'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { turnstileSiteKey } from '@/lib/env.optional'
import { localePath } from '@/i18n/config'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { fail, ok, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getActionLocale } from '@/i18n/server'
import { captchaSchema, otpSchema, phoneSchema } from './schemas'
import { PENDING_PHONE_COOKIE, getViewer, nextStepFor } from './session'

export type AuthFormState = UserResult<null> | null

// Sends the SMS. With Turnstile on, Supabase Auth verifies the captcha token before sending.
async function requestOtp(phone: string, rawCaptcha: unknown): Promise<ErrorKey | null> {
  const captcha = captchaSchema.safeParse(typeof rawCaptcha === 'string' ? rawCaptcha : undefined)
  const captchaToken = captcha.success ? captcha.data || undefined : undefined
  if (turnstileSiteKey && !captchaToken) return 'captchaFailed'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: captchaToken ? { captchaToken } : undefined,
  })
  if (!error) return null
  if (error.code === 'captcha_failed' || /captcha/i.test(error.message)) return 'captchaFailed'
  if (error.status === 429) return 'rateLimited'
  // 403 comes from the Malaysia-only auth hook.
  if (error.status === 403) return 'phoneNotMalaysia'
  return 'smsFailed'
}

export async function sendOtp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = phoneSchema.safeParse({ phone: formData.get('phone') })
  if (!parsed.success) return fail(zodErrorKey(parsed.error))

  const error = await requestOtp(parsed.data.phone, formData.get('captchaToken'))
  if (error) return fail(error)

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

export async function resendOtp(captchaToken?: string): Promise<UserResult> {
  const phone = (await cookies()).get(PENDING_PHONE_COOKIE)?.value
  if (!phone) return fail('sessionExpired')

  const error = await requestOtp(phone, captchaToken)
  return error ? fail(error) : ok(undefined)
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
