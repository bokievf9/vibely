'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { turnstileSiteKey } from '@/lib/env.optional'
import { localePath } from '@/i18n/config'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { fail, ok, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getActionLocale } from '@/i18n/server'
import { captchaTokenFrom, isCaptchaError, requestIp, requestOtp } from './otp'
import { normalizeLoginUsername } from './password'
import { otpSchema, phoneSchema } from './schemas'
import { PENDING_PHONE_COOKIE, getViewer, nextStepFor } from './session'

export type AuthFormState = UserResult<null> | null

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

// Never a real account: the hook only lets +601x mobiles in. Unknown usernames and accounts
// without a password are checked against it, so every failure costs one Supabase round trip and
// returns the same error at about the same time.
const NO_ACCOUNT_PHONE = '+600000000000'
const FAILURE_FLOOR_MS = 900
const PASSWORD_INPUT_MAX = 256

async function slowFailure(started: number, error: ErrorKey): Promise<AuthFormState> {
  const wait = FAILURE_FLOOR_MS + Math.random() * 250 - (Date.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  return fail(error)
}

// Username + password. The username is mapped to the account's phone with the service-role key
// (password_login_check, which also applies the 5-per-username / 20-per-IP limit), then Supabase
// Auth checks the password with the captcha. Unknown username, no password set and wrong password
// all answer `loginFailed`.
export async function signInWithUsername(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const started = Date.now()
  const username = normalizeLoginUsername(String(formData.get('username') ?? '')).slice(0, 40)
  const password = String(formData.get('password') ?? '')
  if (!username || !password) return fail('invalidInput')

  const captchaToken = captchaTokenFrom(formData.get('captchaToken'))
  if (turnstileSiteKey && !captchaToken) return fail('captchaFailed')

  const ip = await requestIp()
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return fail('generic')
  }
  const { data: rows, error: checkError } = await admin.rpc('password_login_check', {
    p_username: username,
    p_ip: ip,
  })
  if (checkError) return fail('generic')
  const check = rows?.[0]
  if (check?.limited) return slowFailure(started, 'loginLocked')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    phone: check?.phone || NO_ACCOUNT_PHONE,
    password:
      password.length > PASSWORD_INPUT_MAX ? password.slice(0, PASSWORD_INPUT_MAX) : password,
    options: captchaToken ? { captchaToken } : undefined,
  })
  if (error || !check?.phone) {
    if (!error) await supabase.auth.signOut()
    // Neither a captcha problem nor Supabase's own rate limit is a password guess.
    if (error && isCaptchaError(error)) return fail('captchaFailed')
    if (error?.status === 429) return slowFailure(started, 'rateLimited')
    await admin.rpc('password_login_record', { p_username: username, p_ip: ip, p_success: false })
    return slowFailure(started, 'loginFailed')
  }

  await admin.rpc('password_login_record', { p_username: username, p_ip: ip, p_success: true })
  // A banned account lands on /banned, like after an SMS sign-in.
  redirect(localePath(await getActionLocale(), nextStepFor(await getViewer())))
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(localePath(await getActionLocale(), '/login'))
}
