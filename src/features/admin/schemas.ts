import { z } from 'zod'
import { Constants } from '@/types/database.types'

const reason = z.string().trim().max(500)
const requiredReason = reason.min(3, { error: 'Укажите причину (минимум 3 символа)' })

export const reviewVerificationSchema = z.discriminatedUnion('approve', [
  z.object({ requestId: z.uuid(), approve: z.literal(true) }),
  z.object({ requestId: z.uuid(), approve: z.literal(false), reason: requiredReason }),
])

export const banSchema = z.discriminatedUnion('banned', [
  z.object({ userId: z.uuid(), banned: z.literal(true), reason: requiredReason }),
  z.object({ userId: z.uuid(), banned: z.literal(false) }),
])

export const revokeSchema = z.object({ userId: z.uuid(), reason: requiredReason })

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
    reason: requiredReason,
  }),
])

export type ResolveInput = z.input<typeof resolveSchema>
