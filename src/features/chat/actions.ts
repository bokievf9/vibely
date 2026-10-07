'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getViewer } from '@/features/auth/session'
import type { ChatMessage } from './types'

const messageSchema = z.object({
  matchId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, { error: 'messageEmpty' satisfies ErrorKey })
    .max(2000, { error: 'messageTooLong' satisfies ErrorKey }),
})

export async function sendMessage(input: {
  matchId: string
  body: string
}): Promise<UserResult<ChatMessage>> {
  const parsed = messageSchema.safeParse(input)
  if (!parsed.success)
    return fail(
      parsed.error.issues[0]?.message === 'messageTooLong' ? 'messageTooLong' : 'messageEmpty',
    )
  const body = sanitizeText(parsed.data.body)
  if (!body) return fail('messageEmpty')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: parsed.data.matchId, body })
    .select('id, body, sender_id, created_at')
    .single()
  if (error) return fail('generic')
  return ok({ id: data.id, body: data.body, senderId: data.sender_id, createdAt: data.created_at })
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
