import { z } from 'zod'
import { Constants } from '@/types/database.types'
import { BAN_CODES, REJECTION_CODES, hasReasonCode } from '@/features/safety/reason-codes'

const reason = z.string().trim().max(500)
const requiredReason = reason.min(3, { error: 'Укажите причину (минимум 3 символа)' })
// Shown to users, translated: must start with a known code ("code" or "code: note").
const codedReason = (codes: readonly string[]) =>
  requiredReason.refine(hasReasonCode(codes), { error: 'Выберите причину из списка' })
const banReason = codedReason(BAN_CODES)

export const reviewVerificationSchema = z.discriminatedUnion('approve', [
  z.object({ requestId: z.uuid(), approve: z.literal(true) }),
  z.object({
    requestId: z.uuid(),
    approve: z.literal(false),
    reason: codedReason(REJECTION_CODES),
  }),
])

// "Looks under 18": reject + ban in one RPC (admin_reject_underage). The duration follows the role.
export const underageSchema = z.object({ requestId: z.uuid() })

export const banSchema = z.discriminatedUnion('banned', [
  z.object({ userId: z.uuid(), banned: z.literal(true), reason: banReason }),
  z.object({ userId: z.uuid(), banned: z.literal(false) }),
])

export const revokeSchema = z.object({ userId: z.uuid(), reason: requiredReason })

export const deletePhotoSchema = z.object({ photoId: z.uuid(), reason: requiredReason })

export const contentSchema = z.object({
  type: z.enum(['post', 'comment']),
  id: z.uuid(),
  hidden: z.boolean(),
  reason: reason.optional(),
})

// One decision on a report group: dismiss, hide the content, or ban the offender.
export const resolveSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('dismiss'),
    targetType: z.enum(Constants.public.Enums.report_target),
    targetId: z.uuid(),
    reason: reason.optional(),
  }),
  z.object({
    decision: z.literal('hide'),
    targetType: z.enum(['post', 'comment']),
    targetId: z.uuid(),
    reason: requiredReason,
  }),
  z.object({
    decision: z.literal('ban'),
    targetType: z.enum(Constants.public.Enums.report_target),
    targetId: z.uuid(),
    offenderId: z.uuid(),
    reason: banReason,
  }),
])

export type ResolveInput = z.input<typeof resolveSchema>
