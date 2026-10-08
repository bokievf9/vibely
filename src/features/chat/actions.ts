'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { notifyNewMessage } from '@/features/push/send'
import { hydrateMessages } from './hydrate'
import { MESSAGE_COLUMNS } from './message-row'
import { sendSchema } from './schemas'
import type { ChatMessage } from './types'

// Text, photo (already uploaded to chat-media by the browser) or both; optionally a reply.
// The database checks that the quoted message and the photo belong to the same match.
export async function sendMessage(
  input: z.input<typeof sendSchema>,
): Promise<UserResult<ChatMessage>> {
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const { matchId, replyTo, image } = parsed.data
  const body = parsed.data.body ? sanitizeText(parsed.data.body) : ''
  if (!body && !image) return fail('messageEmpty')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      body: body || null,
      reply_to: replyTo ?? null,
      image_path: image?.path ?? null,
      image_width: image?.width ?? null,
      image_height: image?.height ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) return fail(rateLimitedOr(error.code, image ? 'photoSendFailed' : 'generic'))
  notifyNewMessage(matchId, data.sender_id, image ? 'photo' : 'text')
  const [message] = await hydrateMessages(supabase, [data])
  return message ? ok(message) : fail('generic')
}

export async function markRead(matchId: string): Promise<void> {
  const id = z.uuid().safeParse(matchId)
  const viewer = await getViewer()
  if (!id.success || !viewer) return
  const supabase = await createClient()
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('match_id', id.data)
    .neq('sender_id', viewer.id)
    .is('read_at', null)
}

export async function unmatch(matchId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(matchId)
  if (!id.success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.from('matches').delete().eq('id', id.data)
  return error ? fail('generic') : ok(undefined)
}
