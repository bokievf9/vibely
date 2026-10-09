import { z } from 'zod'
import { genderSchema } from '@/features/profile/schemas'
import type { AboutInput, ProfilePrompt } from '@/features/profile/about-schemas'
import type { PlanTag } from '@/features/plans/tags'

export const AGE_MIN = 18
export const AGE_MAX = 99
export const DISTANCE_MAX_KM = 300

export const filtersSchema = z
  .object({
    genders: z.array(genderSchema).min(1).max(3),
    minAge: z.number().int().min(AGE_MIN).max(AGE_MAX),
    maxAge: z.number().int().min(AGE_MIN).max(AGE_MAX),
    maxKm: z.number().int().min(1).max(DISTANCE_MAX_KM),
    // "Similar plans": people with the viewer's active plan first (optional: older saved filters).
    similarPlans: z.boolean().optional(),
  })
  .refine((f) => f.minAge <= f.maxAge)

export type SwipeFilters = z.infer<typeof filtersSchema>

export const swipeSchema = z.object({
  targetId: z.uuid(),
  direction: z.enum(['like', 'pass']),
})

export type Candidate = {
  id: string
  name: string
  age: number
  bio: string | null
  city: string | null
  distanceKm: number | null
  tags: string[]
  photos: { url: string; width: number; height: number }[]
  about: AboutInput
  prompts: ProfilePrompt[]
  // Passed more than 14 days ago and shown again.
  secondChance: boolean
  // Active 24-hour plan (optional: not every source knows it).
  plan?: PlanTag | null
  // VIP right now (promo codes, 20261009000230): a small crown next to the name.
  vip?: boolean
}
