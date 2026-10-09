import { z } from 'zod'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { NOTE_MAX } from './card'

const storedPhoto = z
  .object({ path: z.string(), width: z.number(), height: z.number() })
  .nullable()
  .catch(null)

export const rawPerson = z
  .object({ id: z.uuid(), name: z.string(), age: z.number(), photo: storedPhoto })
  .nullable()
  .catch(null)

const state = z.enum(['open', 'interested', 'matched', 'closed', 'pending'])

// get_referral_card() result.
export const rawCardSchema = z.object({
  id: z.uuid(),
  role: z.enum(['matchmaker', 'b', 'c']),
  state,
  note: z.string().nullable(),
  match_id: z.uuid().nullable().catch(null),
  matchmaker_name: z.string().catch(''),
  person: rawPerson.optional(),
  b: rawPerson.optional(),
  c: rawPerson.optional(),
})

export type RawCard = z.infer<typeof rawCardSchema>

export const createSchema = z
  .object({
    partnerId: z.uuid(),
    otherId: z.uuid(),
    note: z
      .string()
      .trim()
      .max(NOTE_MAX, { error: 'noteTooLong' satisfies ErrorKey })
      .optional(),
  })
  .refine((v) => v.partnerId !== v.otherId, { error: 'invalidInput' satisfies ErrorKey })

export const createdSchema = z.object({ id: z.uuid(), match_id: z.uuid() })

// decide_referral() result.
export const decidedSchema = z.object({
  state,
  match_id: z.uuid().nullable().optional(),
  just_matched: z.boolean().optional(),
  notify: z
    .object({
      user_id: z.uuid().optional(),
      match_id: z.uuid().optional(),
      matchmaker_id: z.uuid().optional(),
      matchmaker_name: z.string().optional(),
      b_id: z.uuid().optional(),
      b_name: z.string().optional(),
      c_id: z.uuid().optional(),
      c_name: z.string().optional(),
    })
    .optional(),
})
