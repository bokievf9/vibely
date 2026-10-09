'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getViewer } from '@/features/auth/session'
import type { BlindMessage } from '@/features/blind-date/types'
import { notifyStatusReply } from './notify'
import { getStatuses, parseContext, parseOwnStatus, parsePerson } from './queries'
import { replySchema, statusInputSchema, type ReplyInput, type StatusInput } from './schemas'
import type { OwnStatus, ReplyResult, StatusChat, StatusConversation, StatusesState } from './types'

const uuid = z.uuid()

// The carousel (and own status) for a client refresh after posting or replying.
export async function loadStatuses(): Promise<StatusesState> {
  if (!(await getViewer())) return null
  return getStatuses()
}

// Sets (replaces) the status for 3 hours; with a quick pick the 24-hour plan is set too.
export async function setStatus(input: StatusInput): Promise<UserResult<OwnStatus>> {
  const parsed = statusInputSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  if (!(await getViewer())) return fail('unauthorized')
  const text = sanitizeText(parsed.data.text)
  if (!text) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_status', {
    p_emoji: parsed.data.emoji,
    p_text: text,
    p_plan_tag: parsed.data.planTag ?? undefined,
  })
  if (error)
    return fail(error.code === '42501' ? 'unauthorized' : rateLimitedOr(error.code, 'generic'))
  const own = parseOwnStatus(data)
  return own ? ok(own) : fail('generic')
}

export async function clearStatus(): Promise<UserResult> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('clear_status')
  return error ? fail('generic') : ok(undefined)
}

const replyResultSchema = z.object({
  session_id: z.uuid(),
  message_id: z.uuid().nullable(),
  created: z.boolean(),
  state: z.enum(['active', 'matched', 'passed', 'ended']),
})

function replyError(code: string | undefined): ErrorKey {
  if (code === 'P0429') return 'statusReplyLimit'
  if (code === 'P0002') return 'statusGone'
  if (code === '42501') return 'unauthorized'
  return rateLimitedOr(code, 'generic')
}

// Reply to a status: starts (or continues) the conversation with its author and sends the
// message. The author gets a push ("{name} replied to your status") unless throttled.
export async function replyToStatus(input: ReplyInput): Promise<UserResult<ReplyResult>> {
  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  if (!(await getViewer())) return fail('unauthorized')
  const body = sanitizeText(parsed.data.body)
  if (!body) return fail('messageEmpty')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_status_conversation', {
    p_status: parsed.data.statusId,
    p_body: body,
  })
  if (error) return fail(replyError(error.code))
  const result = replyResultSchema.safeParse(data)
  if (!result.success) return fail('generic')
  if (result.data.message_id) notifyStatusReply(result.data.message_id)
  return ok({ sessionId: result.data.session_id, state: result.data.state })
}

const chatSchema = z.object({
  id: z.uuid(),
  my_side: z.enum(['a', 'b']),
  my_decision: z.boolean().nullable(),
  state: z.enum(['active', 'matched', 'passed', 'ended']),
  partner: z.unknown(),
  match_id: z.uuid().nullable(),
  kind: z.string(),
  context: z.unknown(),
})

// One status conversation (any state). Null when it is not the caller's or not a status one.
export async function getStatusConversation(sessionId: string): Promise<StatusChat | null> {
  if (!uuid.safeParse(sessionId).success) return null
  if (!(await getViewer())) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_blind_session', { p_session: sessionId })
  if (error) return null
  const parsed = chatSchema.safeParse(data?.[0])
  if (!parsed.success || parsed.data.kind !== 'status') return null
  const s = parsed.data
  return {
    id: s.id,
    mySide: s.my_side,
    iAmAuthor: s.my_side === 'a',
    myDecision: s.my_decision,
    state: s.state,
    partner: await parsePerson(s.partner as never),
    context: parseContext(s.context as never),
    matchId: s.state === 'matched' ? s.match_id : null,
  }
}

// Sends a message in a status conversation (same engine and limits as a blind date) and
// notifies the other side (throttled by the database).
export async function sendStatusMessage(
  sessionId: string,
  raw: string,
): Promise<UserResult<BlindMessage>> {
  if (!uuid.safeParse(sessionId).success) return fail('invalidInput')
  const body = sanitizeText(z.string().parse(raw))
  if (!body) return fail('messageEmpty')
  if (body.length > 1000) return fail('messageTooLong')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('randomizer_send', {
    p_session_id: sessionId,
    p_body: body,
  })
  if (error) return fail(rateLimitedOr(error.code, 'generic'))
  notifyStatusReply(data)
  return ok({ id: data, body, mine: true, createdAt: new Date().toISOString() })
}

// "Status replies" on the Chats screen. Empty when the feature is unavailable.
export async function loadStatusConversations(): Promise<StatusConversation[]> {
  if (!(await getViewer())) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_status_conversations')
  if (error || !data) return []
  const stateSchema = z.enum(['active', 'matched', 'passed', 'ended'])
  return Promise.all(
    data.map(
      async (row): Promise<StatusConversation> => ({
        id: row.id,
        state: stateSchema.catch('ended').parse(row.state),
        iAmAuthor: row.i_am_author,
        partner: await parsePerson(row.partner),
        context: parseContext(row.context),
        lastBody: row.last_body,
        lastAt: row.last_at,
        lastMine: Boolean(row.last_mine),
        startedAt: row.started_at,
      }),
    ),
  )
}
