import { z } from 'zod'

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}: минимум ${min} символа`)
    .max(max, `${label}: максимум ${max} символов`)

const options = z
  .array(text(1, 60, 'Вариант'))
  .min(2, 'Нужно от 2 до 4 вариантов')
  .max(4, 'Нужно от 2 до 4 вариантов')

// Admin form of a daily question: three languages, the same number of options in each.
export const promptSchema = z
  .object({
    id: z.uuid().optional(),
    question: z.object({
      en: text(3, 200, 'Вопрос (en)'),
      ms: text(3, 200, 'Вопрос (ms)'),
      ru: text(3, 200, 'Вопрос (ru)'),
    }),
    options: z.object({ en: options, ms: options, ru: options }),
  })
  .refine(
    (v) =>
      v.options.en.length === v.options.ms.length && v.options.en.length === v.options.ru.length,
    { message: 'Одинаковое число вариантов на всех языках' },
  )

export type PromptInput = z.input<typeof promptSchema>
