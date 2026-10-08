'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import { editSchema, reactSchema } from './schemas'
import { CHAT_MEDIA_BUCKET } from './types'

// Own text, within 15 minutes (enforced by edit_message()). Returns the new edited_at.
export async function editMessage(input: z.input<typeof editSchema>): Promise<UserResult<string>> {
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const body = sanitizeText(parsed.data.body)
  if (!body) return fail('messageEmpty')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('edit_message', {
    p_id: parsed.data.messageId,
    p_body: body,
  })
  return error ? fail('messageNotEditable') : ok(data)
}

// Delete for everyone. The photo object goes too: delete_message() only authorizes the caller
// and returns the path, and users have no delete right on chat-media.
export async function deleteMessage(messageId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(messageId)
  if (!id.success) return fail('invalidInput')
  const supabase = await createClient()
  const { data: path, error } = await supabase.rpc('delete_message', { p_id: id.data })
  if (error) return fail('generic')
  if (path) {
    const { error: removeError } = await createAdminClient()
      .storage.from(CHAT_MEDIA_BUCKET)
      .remove([path])
    if (removeError) console.error('[chat] could not remove photo', removeError.message)
  }
  return ok(undefined)
}

// Sets, replaces or (emoji null) removes the caller's reaction.
export async function reactToMessage(input: z.input<typeof reactSchema>): Promise<UserResult> {
  const parsed = reactSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_message_reaction', {
    p_message: parsed.data.messageId,
    p_emoji: parsed.data.emoji ?? '',
  })
  return error ? fail(rateLimitedOr(error.code, 'generic')) : ok(undefined)
}
