'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'

const appealSchema = z.string().max(4000)

// Appeal against a ban, from /banned. The database checks that the account is banned, allows one
// open appeal at a time and at most 3 per 30 days (P0429).
export async function submitAppeal(text: string): Promise<UserResult> {
  const parsed = appealSchema.safeParse(text)
  if (!parsed.success) return fail('invalidInput')
  const body = sanitizeText(parsed.data)
  if (body.length < 10) return fail('appealTooShort')
  if (body.length > 1000) return fail('messageTooLong')

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_appeal', { p_body: body })
  if (error) {
    if (error.code === '23505') return fail('appealOpen')
    if (error.code === '42501') return fail('appealNotBanned')
    return fail(rateLimitedOr(error.code, 'generic'))
  }
  revalidatePath('/[lang]/banned', 'page')
  return ok(undefined)
}

// The warning notice is shown once: acknowledging hides it for good.
export async function acknowledgeWarning(id: string): Promise<UserResult> {
  if (!z.uuid().safeParse(id).success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('acknowledge_warning', { p_id: id })
  return error ? fail('generic') : ok(undefined)
}
