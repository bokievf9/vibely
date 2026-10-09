import { z } from 'zod'
import { planTagSchema } from '@/features/plans/tags'
import { codePoints, isSingleEmoji, STATUS_MAX_LENGTH } from './format'

export const statusInputSchema = z.object({
  emoji: z.string().refine(isSingleEmoji, 'statusEmojiRequired'),
  text: z
    .string()
    .trim()
    .min(1, 'invalidInput')
    .refine((v) => codePoints(v) <= STATUS_MAX_LENGTH, 'statusTooLong'),
  planTag: planTagSchema.nullable(),
})

export type StatusInput = z.infer<typeof statusInputSchema>
