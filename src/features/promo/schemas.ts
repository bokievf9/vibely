import { z } from 'zod'
import type { ErrorKey } from '@/i18n/dictionaries/en'

// Mirrors public.normalize_promo_code(): trim, drop inner whitespace, upper case.
export function normalizePromoCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

// Same rule as the promo_codes_code_format check constraint.
export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/

export const isValidPromoCode = (raw: string) => PROMO_CODE_RE.test(normalizePromoCode(raw))

// Normalised value or the `promoFormat` error key. An empty optional field is handled by the
// callers (onboarding), where the whole field may stay empty.
export const promoCodeSchema = z
  .string()
  .transform(normalizePromoCode)
  .refine((c) => PROMO_CODE_RE.test(c), { error: 'promoFormat' satisfies ErrorKey })

export const redeemSchema = z.object({ code: promoCodeSchema })

// What redeem_promo() returns (jsonb). Since 20261009000280 codes grant a plan ({plan, days});
// older databases and old codes use {vip_days} (= VIP). `error` rows become ErrorKeys below.
const plan = z.enum(['plus', 'vip']).nullable().optional()
export const redeemResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('error'), error: z.string() }),
  z.object({
    status: z.literal('pending'),
    code: z.string(),
    benefits: z.object({
      plan,
      days: z.number().optional(),
      vip_days: z.number().optional(),
      boost_hours: z.number().optional(),
    }),
  }),
  z.object({
    status: z.literal('granted'),
    code: z.string(),
    plan,
    days: z.number().optional(),
    vip_days: z.number().optional(),
    plan_until: z.string().nullable().optional(),
    vip_until: z.string().nullable().optional(),
    boost_hours: z.number(),
    boost_until: z.string().nullable(),
  }),
])

export type PromoOutcome = {
  status: 'granted' | 'pending'
  code: string
  plan: 'plus' | 'vip' | null
  days: number
  boostHours: number
  // Set when granted (Malaysia time is applied when shown).
  planUntil: string | null
  boostUntil: string | null
}

// Stable error codes of redeem_promo() mapped to translation keys.
const ERROR_KEYS: Record<string, ErrorKey> = {
  invalid: 'promoInvalid',
  expired: 'promoExpired',
  used_up: 'promoUsedUp',
  not_for_you: 'promoNotForYou',
  already_redeemed: 'promoAlreadyRedeemed',
  too_many_attempts: 'promoTooManyAttempts',
}

export const promoErrorKey = (code: string): ErrorKey => ERROR_KEYS[code] ?? 'generic'

export function outcomeFromResult(r: z.infer<typeof redeemResultSchema>): PromoOutcome | ErrorKey {
  if (r.status === 'error') return promoErrorKey(r.error)
  if (r.status === 'pending') {
    const b = r.benefits
    return {
      status: 'pending',
      code: r.code,
      plan: b.plan ?? (b.vip_days ? 'vip' : null),
      days: b.days ?? b.vip_days ?? 0,
      boostHours: b.boost_hours ?? 0,
      planUntil: null,
      boostUntil: null,
    }
  }
  return {
    status: 'granted',
    code: r.code,
    plan: r.plan ?? (r.vip_days ? 'vip' : null),
    days: r.days ?? r.vip_days ?? 0,
    boostHours: r.boost_hours,
    planUntil: r.plan_until ?? r.vip_until ?? null,
    boostUntil: r.boost_until,
  }
}
