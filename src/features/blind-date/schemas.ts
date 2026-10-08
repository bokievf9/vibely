import { z } from 'zod'
import { Constants } from '@/types/database.types'
import { genderSchema } from '@/features/profile/schemas'

export const joinSchema = z
  .object({
    genders: z.array(genderSchema).min(1).max(3),
    minAge: z.number().int().min(18).max(99),
    maxAge: z.number().int().min(18).max(99),
    tagIds: z.array(z.number().int().positive()).max(10),
  })
  .refine((f) => f.minAge <= f.maxAge)

export type JoinFilters = z.infer<typeof joinSchema>

export const partnerSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  age: z.number(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  relationship_goal: z.enum(Constants.public.Enums.relationship_goal).nullable().catch(null),
  job_title: z.string().nullable().catch(null),
})
