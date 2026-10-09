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

// What redeem_promo() returns (jsonb). `error` rows are turned into ErrorKeys below.
export const redeemResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('error'), error: z.string() }),
  z.object({
    status: z.literal('pending'),
    code: z.string(),
    benefits: z.object({
      vip_days: z.number().optional(),
      boost_hours: z.number().optional(),
      see_likes: z.boolean().optional(),
      queue_priority: z.boolean().optional(),
    }),
  }),
  z.object({
    status: z.literal('granted'),
    code: z.string(),
    vip_days: z.number(),
    boost_hours: z.number(),
    vip_until: z.string().nullable(),
    boost_until: z.string().nullable(),
    perks: z.object({
      see_likes: z.boolean().optional(),
      queue_priority: z.boolean().optional(),
    }),
  }),
])

export type PromoOutcome = {
  status: 'granted' | 'pending'
  code: string
  vipDays: number
  boostHours: number
  seeLikes: boolean
  queuePriority: boolean
  // Set when granted (Malaysia time is applied when shown).
  vipUntil: string | null
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
    return {
      status: 'pending',
      code: r.code,
      vipDays: r.benefits.vip_days ?? 0,
      boostHours: r.benefits.boost_hours ?? 0,
      seeLikes: r.benefits.see_likes ?? false,
      queuePriority: r.benefits.queue_priority ?? false,
      vipUntil: null,
      boostUntil: null,
    }
  }
  return {
    status: 'granted',
    code: r.code,
    vipDays: r.vip_days,
    boostHours: r.boost_hours,
    seeLikes: r.perks.see_likes ?? false,
    queuePriority: r.perks.queue_priority ?? false,
    vipUntil: r.vip_until,
    boostUntil: r.boost_until,
  }
}
