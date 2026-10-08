import { z } from 'zod'
import { Constants } from '@/types/database.types'
import { BAN_CODES, hasReasonCode } from '@/features/safety/reason-codes'

const target = z.enum(Constants.public.Enums.report_target)
const reason = z.string().trim().max(500)
const requiredReason = reason.min(3, { error: 'Укажите причину (минимум 3 символа)' })
const banReason = requiredReason.refine(hasReasonCode(BAN_CODES), {
  error: 'Выберите причину из списка',
})

export const caseSchema = z.object({ targetType: target, targetId: z.uuid() })

// One decision on a case, applied atomically by admin_resolve_case.
export const resolveCaseSchema = z.discriminatedUnion('decision', [
  caseSchema.extend({ decision: z.literal('dismiss'), reason: reason.optional() }),
  caseSchema.extend({
    decision: z.literal('hide'),
    targetType: z.enum(['post', 'comment']),
    reason: requiredReason,
  }),
  caseSchema.extend({
    decision: z.literal('ban'),
    offenderId: z.uuid(),
    reason: banReason,
  }),
  caseSchema.extend({
    decision: z.literal('delete_photo'),
    targetType: z.literal('photo'),
    reason: requiredReason,
  }),
])
export type ResolveCaseInput = z.input<typeof resolveCaseSchema>

export const bulkDismissSchema = z.object({
  cases: z.array(caseSchema).min(1).max(100),
  reason: reason.optional(),
})

// Evidence: always tied to one open report (its reporter) of a case.
export const evidenceSchema = caseSchema.extend({ reporterId: z.uuid() })
export const chatMediaSchema = evidenceSchema.extend({ messageId: z.uuid() })

export const keywordSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(3, { error: 'Минимум 3 символа' })
    .max(60, { error: 'Максимум 60 символов' }),
  weight: z.number().int().min(1).max(10),
})

export const photoIdsSchema = z.object({ photoIds: z.array(z.uuid()).min(1).max(200) })
export const bulkDeletePhotosSchema = photoIdsSchema.extend({ reason: requiredReason })
