'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getViewer } from '@/features/auth/session'
import { notifyNewMessage } from '@/features/push/send'
import { MESSAGE_COLUMNS, toChatMessage } from './message-row'
import type { ChatMessage, MessagePage } from './types'

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
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) return fail(rateLimitedOr(error.code, 'generic'))
  notifyNewMessage(parsed.data.matchId, data.sender_id)
  return ok(toChatMessage(data))
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

// Fills gaps the live subscription can miss: right after joining (Realtime needs a moment to
// attach postgres_changes) and after reconnects. RLS limits rows to the caller's own matches.
export async function loadMessagesAfter(
  matchId: string,
  after: string | null,
): Promise<ChatMessage[]> {
  const id = z.uuid().safeParse(matchId)
  if (!id.success) return []
  const supabase = await createClient()
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('match_id', id.data)
    .order('created_at')
    .limit(200)
  if (after && z.iso.datetime({ offset: true }).safeParse(after).success)
    query = query.gt('created_at', after)
  const { data } = await query
  return (data ?? []).map(toChatMessage)
}

const PAGE_SIZE = 50

const beforeSchema = z.object({ matchId: z.uuid(), before: z.iso.datetime({ offset: true }) })

// Older history for "load earlier messages": the page right before the oldest loaded message.
// RLS limits rows to the caller's own matches.
export async function loadMessagesBefore(input: {
  matchId: string
  before: string
}): Promise<UserResult<MessagePage>> {
  const parsed = beforeSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('match_id', parsed.data.matchId)
    .lt('created_at', parsed.data.before)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (error) return fail('generic')
  return ok({
    messages: data.slice(0, PAGE_SIZE).reverse().map(toChatMessage),
    hasMore: data.length > PAGE_SIZE,
  })
}
