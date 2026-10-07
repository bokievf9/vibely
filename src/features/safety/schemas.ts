import { z } from 'zod'
import { Constants } from '@/types/database.types'

export const REPORT_REASONS = ['fake', 'harassment', 'spam', 'sexual', 'scam', 'underage'] as const

export const reportSchema = z.object({
  targetType: z.enum(Constants.public.Enums.report_target),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500),
})

export type ReportInput = z.infer<typeof reportSchema>

export const blockSchema = z.object({ userId: z.uuid() })
