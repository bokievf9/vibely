'use server'

import { headers } from 'next/headers'
import { phoneSchema } from '@/features/auth/schemas'
import { hasLocale } from '@/i18n/config'
import { getTurnstileSecret } from '@/lib/env.server'
import { createAnonClient } from '@/lib/supabase/anon'
import { waitlistErrorFromDb, type WaitlistError, type WaitlistResult } from './errors'
import { isWaitlistCity, normalizeMalaysianMobile } from './phone'
import { verifyTurnstile } from './turnstile-verify'

const TURNSTILE_ACTION = 'waitlist'
const PHONE_ERRORS: readonly WaitlistError[] = ['phoneInvalid', 'phoneNotMalaysia', 'phoneNotMobile']

const text = (form: FormData, key: string) => {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

// Early access form on the landing page. Order: cheap checks first, then Turnstile (when
// TURNSTILE_SECRET_KEY is set), then join_waitlist, which validates again, applies the per-number
// and global rate limits and is idempotent. Answers the same way whether the number was already
// on the list or not.
export async function joinWaitlist(form: FormData): Promise<WaitlistResult> {
  if (text(form, 'consent') !== 'on') return { ok: false, error: 'consentRequired' }

  const digits = normalizeMalaysianMobile(text(form, 'phone').slice(0, 32))
  if (!digits) return { ok: false, error: 'phoneInvalid' }
  // Mobile vs landline needs libphonenumber's full metadata (server only).
  const parsed = phoneSchema.shape.phone.safeParse(`+${digits}`)
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message as WaitlistError | undefined
    return { ok: false, error: key && PHONE_ERRORS.includes(key) ? key : 'phoneInvalid' }
  }

  const cityRaw = text(form, 'city')
  if (cityRaw && !isWaitlistCity(cityRaw)) return { ok: false, error: 'cityInvalid' }
  const localeRaw = text(form, 'locale')
  const locale = hasLocale(localeRaw) ? localeRaw : 'en'
  const sourceRaw = text(form, 'source')
  const source = /^[a-z0-9_-]{1,32}$/.test(sourceRaw) ? sourceRaw : 'landing'

  const h = await headers()
  // Nginx sets X-Real-IP (docs/deploy.md); it is only a hint for Cloudflare.
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const captcha = await verifyTurnstile({
    secret: getTurnstileSecret(),
    token: text(form, 'captchaToken'),
    ip,
    action: TURNSTILE_ACTION,
  })
  if (captcha === 'failed') return { ok: false, error: 'captchaFailed' }

  const { error } = await createAnonClient().rpc('join_waitlist', {
    p_phone: parsed.data,
    p_city: cityRaw || null,
    p_locale: locale,
    p_source: source,
    p_consent: true,
  })
  if (error) {
    const key = waitlistErrorFromDb(error)
    if (key === 'generic') console.error('[waitlist] join_waitlist', error.code, error.message)
    return { ok: false, error: key }
  }
  return { ok: true }
}
