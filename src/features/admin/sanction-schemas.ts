import { z } from 'zod'
import { BAN_CODES, hasReasonCode } from '@/features/safety/reason-codes'
import { ADMIN_ROLES } from './roles'

const note = z.string().trim().max(500)
const requiredNote = note.min(3, { error: 'Укажите причину (минимум 3 символа)' })
// Shown to the user translated: must start with a ban reason code ("code" or "code: note").
const codedReason = requiredNote.refine(hasReasonCode(BAN_CODES), {
  error: 'Выберите причину из списка',
})

export const warnSchema = z.object({
  userId: z.uuid(),
  reason: codedReason,
  note: note.optional(),
  days: z.int().min(1).max(365),
})

export const revokeWarningSchema = z.object({ warningId: z.uuid(), reason: note.optional() })

export const muteSchema = z.discriminatedUnion('mute', [
  z.object({
    userId: z.uuid(),
    mute: z.literal(true),
    hours: z.int().min(1).max(720),
    reason: codedReason,
  }),
  z.object({ userId: z.uuid(), mute: z.literal(false) }),
])

// days null = permanent.
export const banUserSchema = z.object({
  userId: z.uuid(),
  reason: codedReason,
  days: z.int().min(1).max(365).nullable(),
  blockPhone: z.boolean(),
})

export const unbanSchema = z.object({ userId: z.uuid(), reason: note.optional() })

export const flagSchema = z.object({ userId: z.uuid(), on: z.boolean(), reason: note.optional() })

export const holdSchema = z.discriminatedUnion('on', [
  z.object({ userId: z.uuid(), on: z.literal(true), reason: requiredNote }),
  z.object({ userId: z.uuid(), on: z.literal(false), reason: note.optional() }),
])

export const userIdSchema = z.object({ userId: z.uuid() })

export const exportSchema = z.object({
  userId: z.uuid(),
  reference: z
    .string()
    .trim()
    .min(3, { error: 'Укажите номер запроса (минимум 3 символа)' })
    .max(200),
})

export const noteSchema = z.object({
  userId: z.uuid(),
  body: z.string().trim().min(1, { error: 'Пустая заметка' }).max(2000),
})

export const noteIdSchema = z.object({ noteId: z.uuid() })

export const blockPhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,20}$/, { error: 'Номер в формате +60 12 345 6789' }),
  reason: note.optional(),
})

export const unblockPhoneSchema = z.object({ id: z.uuid(), reason: note.optional() })

export const memberSchema = z.object({
  query: z.string().trim().min(3, { error: 'Телефон, @username или ID' }).max(100),
  role: z.enum(ADMIN_ROLES),
})

export const memberRoleSchema = z.object({ userId: z.uuid(), role: z.enum(ADMIN_ROLES) })

export const removeMemberSchema = z.object({ userId: z.uuid() })

export const decideAppealSchema = z.discriminatedUnion('accept', [
  z.object({ appealId: z.uuid(), accept: z.literal(true), note: note.optional() }),
  z.object({ appealId: z.uuid(), accept: z.literal(false), note: requiredNote }),
])
