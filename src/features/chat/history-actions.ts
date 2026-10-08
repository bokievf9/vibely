'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { hydrateMessages, loadReactionsFor, signChatPaths } from './hydrate'
import { MESSAGE_COLUMNS } from './message-row'
import type { ChatMessage, MessagePage, Reaction } from './types'

const PAGE_SIZE = 50
const MAX_IDS = 200

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
  return hydrateMessages(supabase, data ?? [])
}

const idsSchema = z.object({ matchId: z.uuid(), ids: z.array(z.uuid()).max(MAX_IDS) })

// Full messages (signed photo URL, quoted message) for rows that arrived over Realtime.
export async function loadMessagesById(input: {
  matchId: string
  ids: string[]
}): Promise<ChatMessage[]> {
  const parsed = idsSchema.safeParse(input)
  if (!parsed.success || !parsed.data.ids.length) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('match_id', parsed.data.matchId)
    .in('id', parsed.data.ids)
  return hydrateMessages(supabase, data ?? [])
}

// Current reactions on loaded messages (resync after Realtime (re)connects).
export async function loadReactions(input: {
  matchId: string
  ids: string[]
}): Promise<Reaction[]> {
  const parsed = idsSchema.safeParse(input)
  if (!parsed.success) return []
  return loadReactionsFor(await createClient(), parsed.data.matchId, parsed.data.ids)
}

const pathsSchema = z.array(z.string().max(100)).max(MAX_IDS)

// Fresh signed URLs when old ones expired (long-open chat). Storage RLS checks access.
export async function signChatImages(paths: string[]): Promise<Record<string, string>> {
  const parsed = pathsSchema.safeParse(paths)
  if (!parsed.success) return {}
  return Object.fromEntries(await signChatPaths(await createClient(), parsed.data))
}

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
  const rows = data.slice(0, PAGE_SIZE).reverse()
  const [messages, reactions] = await Promise.all([
    hydrateMessages(supabase, rows),
    loadReactionsFor(
      supabase,
      parsed.data.matchId,
      rows.map((r) => r.id),
    ),
  ])
  return ok({ messages, reactions, hasMore: data.length > PAGE_SIZE })
}
