import { z } from 'zod'
// "max" metadata is needed to tell mobile numbers from landlines (SMS needs a mobile).
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import type { ErrorKey } from '@/i18n/dictionaries/en'

// Vibely is Malaysia-only. Supabase Auth enforces the same rule (hook_before_user_created).
export const PHONE_REGION = 'MY'

const issue = (ctx: z.RefinementCtx, message: ErrorKey) => {
  ctx.addIssue({ code: 'custom', message })
  return z.NEVER
}

export const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(5, { error: 'phoneRequired' satisfies ErrorKey })
    .transform((value, ctx) => {
      const parsed = parsePhoneNumberFromString(value, PHONE_REGION)
      if (!parsed?.isValid()) return issue(ctx, 'phoneInvalid')
      if (parsed.country !== PHONE_REGION) return issue(ctx, 'phoneNotMalaysia')
      if (parsed.getType() !== 'MOBILE') return issue(ctx, 'phoneNotMobile')
      return parsed.number // E.164, e.g. +60123456789
    }),
})

export const otpSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: 'otpFormat' satisfies ErrorKey }),
})

// Cloudflare Turnstile token (single use, max 2048 chars). Absent when captcha is off.
export const captchaSchema = z.string().trim().max(2048).optional()
