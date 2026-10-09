import { z } from 'zod'

// Promo codes (/admin/promo). The database re-checks every rule (admin_upsert_promo).
// Benefits since 20261009000280: a plan (Plus or VIP) for N days and/or boost hours.
export const PROMO_PLANS = ['plus', 'vip'] as const

export const promoBenefitsSchema = z
  .object({
    plan: z.enum(PROMO_PLANS).nullable(),
    days: z.int().min(0).max(3650),
    boostHours: z.int().min(0).max(8760),
  })
  .refine((b) => b.plan === null || b.days > 0, {
    error: 'Для плана укажите срок в днях (от 1)',
  })
  .refine((b) => b.plan !== null || b.boostHours > 0, {
    error: 'Укажите хотя бы один бонус (план или часы буста)',
  })

export type PromoBenefits = z.infer<typeof promoBenefitsSchema>

export const upsertPromoSchema = z.object({
  id: z.uuid().nullable(),
  code: z
    .string()
    .trim()
    .min(3, { error: 'Код: минимум 3 символа' })
    .max(40, { error: 'Код: максимум 32 символа' })
    .refine((c) => /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(c.replace(/\s+/g, '')), {
      error: 'Код: латинские буквы, цифры, _ и - (3 до 32 символов)',
    }),
  maxUses: z.int().min(1, { error: 'Лимит: от 1' }).max(1_000_000).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  benefits: promoBenefitsSchema,
  gender: z.enum(['male', 'female']).nullable(),
  requiresVerified: z.boolean(),
})

export type UpsertPromoInput = z.input<typeof upsertPromoSchema>

export const setPromoActiveSchema = z.object({ id: z.uuid(), active: z.boolean() })

export const promoIdSchema = z.object({ id: z.uuid() })
