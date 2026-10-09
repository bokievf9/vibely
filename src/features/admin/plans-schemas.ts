import { z } from 'zod'

// Plans matrix and grants (/admin/plans). The database re-checks every rule (admin_* RPCs of
// 20261009000280) and logs every change (plan.feature / plan.limit / plan.grant / plan.revoke).
export const PLAN_LEVELS = ['free', 'plus', 'vip'] as const
export type PlanLevel = (typeof PLAN_LEVELS)[number]

export const LIMIT_PERIODS = ['day', 'week', 'month'] as const
export type LimitPeriod = (typeof LIMIT_PERIODS)[number]

const featureKey = z.string().regex(/^[a-z0-9_]{2,40}$/, { error: 'Неверный ключ функции' })

export const setFeatureSchema = z.object({
  key: featureKey,
  enabled: z.boolean(),
  minPlan: z.enum(PLAN_LEVELS),
  note: z.string().trim().max(500, { error: 'Заметка: максимум 500 символов' }).nullable(),
})

export const setLimitSchema = z.object({
  key: featureKey,
  plan: z.enum(PLAN_LEVELS),
  // null: unlimited.
  value: z.int({ error: 'Лимит: целое число' }).min(0).max(100_000).nullable(),
  // null: no window (in total).
  period: z.enum(LIMIT_PERIODS).nullable(),
})

export const lookupUserSchema = z.object({
  query: z.string().trim().min(2, { error: 'Введите @username, телефон или id' }).max(80),
})

export const grantPlanSchema = z.object({
  userId: z.uuid(),
  plan: z.enum(['plus', 'vip']),
  // null: no end.
  days: z.int({ error: 'Дни: целое число' }).min(1, { error: 'Дни: от 1' }).max(3650).nullable(),
  note: z.string().trim().max(500, { error: 'Заметка: максимум 500 символов' }).nullable(),
})

export const revokeGrantSchema = z.object({ id: z.uuid(), userId: z.uuid() })
