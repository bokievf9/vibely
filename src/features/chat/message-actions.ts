'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import { editSchema, reactSchema } from './schemas'

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

// Delete for everyone: the message disappears for both people at once. Per the safety protocol
// its content is archived for moderators and purged after 90 days (20261008000131).
export async function deleteMessage(messageId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(messageId)
  if (!id.success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_message', { p_id: id.data })
  if (error) return fail('generic')
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
