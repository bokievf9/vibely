import { z } from 'zod'
import { genderSchema } from '@/features/profile/schemas'
import type { AboutInput, ProfilePrompt } from '@/features/profile/about-schemas'

export const AGE_MIN = 18
export const AGE_MAX = 99
export const DISTANCE_MAX_KM = 300

export const filtersSchema = z
  .object({
    genders: z.array(genderSchema).min(1).max(3),
    minAge: z.number().int().min(AGE_MIN).max(AGE_MAX),
    maxAge: z.number().int().min(AGE_MIN).max(AGE_MAX),
    maxKm: z.number().int().min(1).max(DISTANCE_MAX_KM),
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
}
