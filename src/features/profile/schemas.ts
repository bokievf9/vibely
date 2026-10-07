import { z } from 'zod'
import { Constants } from '@/types/database.types'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { ageFromBirthDate } from '@/lib/utils'

const e = (key: ErrorKey) => ({ error: key })

export const genderSchema = z.enum(Constants.public.Enums.gender, e('genderRequired'))

// Russian labels for the (Russian-only) admin panel. Users see dictionary labels.
export const GENDER_LABELS: Record<z.infer<typeof genderSchema>, string> = {
  male: 'Мужчина',
  female: 'Женщина',
  other: 'Другое',
}

export const MAX_TAGS = 10
export const MAX_PHOTOS = 6

// Fields a user may change after onboarding (birth date and gender are fixed).
export const editableProfileSchema = z.object({
  displayName: z.string().trim().min(2, e('nameTooShort')).max(40, e('nameTooLong')),
  interestedIn: z.array(genderSchema).min(1, e('interestedInRequired')).max(3),
  bio: z.string().trim().max(500, e('bioTooLong')),
  city: z.string().trim().max(80),
  tagIds: z.array(z.number().int().positive()).max(MAX_TAGS, e('tooManyTags')),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable(),
})

export const profileSchema = editableProfileSchema.extend({
  birthDate: z.iso
    .date(e('birthDateRequired'))
    .refine((d) => ageFromBirthDate(d) >= 18, e('tooYoung'))
    .refine((d) => ageFromBirthDate(d) <= 99, e('birthDateInvalid')),
  gender: genderSchema,
})

export type ProfileInput = z.infer<typeof profileSchema>
export type EditableProfileInput = z.infer<typeof editableProfileSchema>

export const photoSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpe?g|png)$/),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  position: z
    .number()
    .int()
    .min(0)
    .max(MAX_PHOTOS - 1),
})

export type PhotoInput = z.infer<typeof photoSchema>
