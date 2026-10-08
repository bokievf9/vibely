import 'server-only'
import { headers } from 'next/headers'
import { isIP } from 'node:net'
import { createClient } from '@/lib/supabase/server'
import { turnstileSiteKey } from '@/lib/env.optional'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { captchaSchema } from './schemas'

// Turnstile token from a form field or argument; undefined when absent or malformed.
export function captchaTokenFrom(raw: unknown): string | undefined {
  const captcha = captchaSchema.safeParse(typeof raw === 'string' ? raw : undefined)
  return captcha.success ? captcha.data || undefined : undefined
}

// Sends the SMS. With Turnstile on, Supabase Auth verifies the captcha token before sending.
// `existingOnly`: re-authentication of a signed-in user, never creates an account.
export async function requestOtp(
  phone: string,
  rawCaptcha: unknown,
  { existingOnly = false }: { existingOnly?: boolean } = {},
): Promise<ErrorKey | null> {
  const captchaToken = captchaTokenFrom(rawCaptcha)
  if (turnstileSiteKey && !captchaToken) return 'captchaFailed'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      ...(captchaToken ? { captchaToken } : {}),
      ...(existingOnly ? { shouldCreateUser: false } : {}),
    },
  })
  if (!error) return null
  if (isCaptchaError(error)) return 'captchaFailed'
  if (error.status === 429) return 'rateLimited'
  // 403 comes from the Malaysia-only auth hook.
  if (error.status === 403) return 'phoneNotMalaysia'
  return 'smsFailed'
}

export const isCaptchaError = (error: { code?: string; message: string }) =>
  error.code === 'captcha_failed' || /captcha/i.test(error.message)

// The client's address as Nginx saw it. Nginx sets X-Real-IP to $remote_addr; behind it the last
// X-Forwarded-For hop is the one Nginx added. Null when neither is a valid address (local dev).
export async function requestIp(): Promise<string | null> {
  const h = await headers()
  const candidates = [h.get('x-real-ip'), h.get('x-forwarded-for')?.split(',').at(-1)].map(
    (v) => v?.trim() ?? '',
  )
  return candidates.find((v) => isIP(v) !== 0) ?? null
}
