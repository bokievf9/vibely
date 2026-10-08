import { z } from 'zod'
import type { ErrorKey } from '@/i18n/dictionaries/en'

// The word the user types to confirm deletion. Same in every language, so it is easy to support.
export const DELETE_CONFIRM_WORD = 'DELETE'

const e = (key: ErrorKey) => ({ error: key })

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .refine((v) => v.trim().toUpperCase() === DELETE_CONFIRM_WORD, e('deleteConfirmMismatch')),
})

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>
