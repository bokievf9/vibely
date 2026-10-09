import { z } from 'zod'

const title = z
  .string()
  .trim()
  .min(1, { error: 'Заполните название на всех трёх языках' })
  .max(80, { error: 'Название: не больше 80 символов' })

// The events form (/admin/events). Date and times are Malaysia time; see event-time.ts.
export const eventFormSchema = z.object({
  id: z.uuid().nullable(),
  titleEn: title,
  titleMs: title,
  titleRu: title,
  theme: z.string().trim().max(120, { error: 'Тема: не больше 120 символов' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Укажите дату' }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, { error: 'Укажите время начала' }),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, { error: 'Укажите время окончания' }),
  weekly: z.boolean(),
  draft: z.boolean(),
})

export type EventFormInput = z.input<typeof eventFormSchema>

export const cancelEventSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().max(200).optional(),
})
