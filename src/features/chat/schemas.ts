import { z } from 'zod'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { REACTIONS } from './types'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export const bodySchema = z
  .string()
  .trim()
  .max(2000, { error: 'messageTooLong' satisfies ErrorKey })

export const imageSchema = z.object({
  path: z.string().regex(new RegExp(`^${UUID}/${UUID}\\.webp$`)),
  width: z.int().min(1).max(10000),
  height: z.int().min(1).max(10000),
})

export const sendSchema = z
  .object({
    matchId: z.uuid(),
    body: bodySchema.optional(),
    replyTo: z.uuid().nullish(),
    image: imageSchema.nullish(),
  })
  .refine((v) => !v.image || v.image.path.startsWith(`${v.matchId}/`), {
    error: 'invalidInput' satisfies ErrorKey,
  })

export const editSchema = z.object({
  messageId: z.uuid(),
  body: bodySchema.min(1, { error: 'messageEmpty' satisfies ErrorKey }),
})

export const reactSchema = z.object({
  messageId: z.uuid(),
  emoji: z.enum(REACTIONS).nullable(),
})
