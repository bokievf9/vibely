import { z } from 'zod'

// Plans (20261009000280): free < plus < vip. The matrix lives in the database (features,
// plan_limits) and is read once per request through my_access(); this module only interprets it.
// Client-safe: no server imports.

export const PLAN_LEVELS = ['free', 'plus', 'vip'] as const
export type PlanLevel = (typeof PLAN_LEVELS)[number]

// Every key of public.features. Reserved keys belong to VIP features built elsewhere.
export const FEATURE_KEYS = [
  'likes_per_day',
  'who_liked_you',
  'chat_photos',
  'voice_messages',
  'video_messages',
  'calls',
  'feed_post',
  'feed_comment',
  'feed_like',
  'blind_dating_per_day',
  'event_priority',
  'incognito',
  'boost',
  'crush_links_per_30d',
  'duo',
  'statuses',
  'crossed_paths',
  'vip_badge',
  'read_receipts',
  'profile_visitors',
  'discover_priority',
  'message_before_match',
] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const isFeatureKey = (value: unknown): value is FeatureKey =>
  typeof value === 'string' && (FEATURE_KEYS as readonly string[]).includes(value)

export type LimitPeriod = 'day' | 'week' | 'month'

export type FeatureAccess = {
  on: boolean
  minPlan: PlanLevel
  // null = unlimited
  limit: number | null
  period: LimitPeriod | null
  // Uses in the current window, only for features with a limit.
  used: number | null
}

export type Access = {
  // false when my_access() is not deployed yet (or failed): everything is allowed, as before
  // plans existed. The database still enforces whatever it knows.
  available: boolean
  plan: PlanLevel
  isStaff: boolean
  planUntil: string | null
  boostUntil: string | null
  features: Partial<Record<FeatureKey, FeatureAccess>>
}

export const FULL_ACCESS: Access = {
  available: false,
  plan: 'free',
  isStaff: false,
  planUntil: null,
  boostUntil: null,
  features: {},
}

const level = z.enum(PLAN_LEVELS)
const myAccessSchema = z.object({
  plan: level,
  is_staff: z.boolean(),
  plan_until: z.string().nullable(),
  boost_until: z.string().nullable(),
  features: z.record(
    z.string(),
    z.object({
      on: z.boolean(),
      min_plan: level,
      limit: z.number().nullable(),
      period: z.enum(['day', 'week', 'month']).nullable(),
      used: z.number().nullable(),
    }),
  ),
})

// my_access() jsonb -> Access. Anything unexpected falls back to FULL_ACCESS (never lock people out
// because of a parsing problem: the database is the gate).
export function parseAccess(data: unknown): Access {
  const parsed = myAccessSchema.safeParse(data)
  if (!parsed.success) return FULL_ACCESS
  const a = parsed.data
  const features: Access['features'] = {}
  for (const [key, f] of Object.entries(a.features)) {
    if (!isFeatureKey(key)) continue
    features[key] = {
      on: f.on,
      minPlan: f.min_plan,
      limit: f.limit,
      period: f.period,
      used: f.used,
    }
  }
  return {
    available: true,
    plan: a.plan,
    isStaff: a.is_staff,
    planUntil: a.plan_until,
    boostUntil: a.boost_until,
    features,
  }
}

export function hasFeature(access: Access, key: FeatureKey): boolean {
  if (!access.available) return true
  return access.features[key]?.on ?? false
}

// null = unlimited (or not known).
export function featureLimit(access: Access, key: FeatureKey): number | null {
  if (!access.available) return null
  const f = access.features[key]
  if (!f) return null
  return f.on ? f.limit : 0
}

// Uses left in the current window; null = unlimited.
export function featureRemaining(access: Access, key: FeatureKey): number | null {
  const limit = featureLimit(access, key)
  if (limit === null) return null
  return Math.max(0, limit - (access.features[key]?.used ?? 0))
}

// The level that unlocks a feature (or a higher quota): its min plan, or the next level up when
// the user already has it but ran out.
export function upgradePlanFor(access: Access, key: FeatureKey): Exclude<PlanLevel, 'free'> {
  const f = access.features[key]
  const min = f?.minPlan ?? 'plus'
  if (min === 'vip' || access.plan === 'plus' || access.plan === 'vip') return 'vip'
  return 'plus'
}

// Features the given level unlocks (for the "Plus also unlocks" list), in matrix order.
export function featuresOf(access: Access, plan: PlanLevel): FeatureKey[] {
  return FEATURE_KEYS.filter((k) => access.features[k]?.minPlan === plan)
}

// Records one more use locally (the next request reads the real count).
export function withUse(access: Access, key: FeatureKey): Access {
  const f = access.features[key]
  if (!f || f.limit === null) return access
  return { ...access, features: { ...access.features, [key]: { ...f, used: (f.used ?? 0) + 1 } } }
}
