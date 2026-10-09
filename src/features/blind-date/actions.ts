'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { signPhotoPaths } from '@/features/profile/queries'
import { notifyBlindMatch } from '@/features/push/send'
import { toPseudonym } from '@/features/feed/pseudonym'
import { notifyConversationMessage } from './notify'
import { joinSchema, partnerSchema, type JoinFilters } from './schemas'
import type {
  BlindMessage,
  BlindSession,
  BlindState,
  ConversationPreview,
  DecideResult,
  RevealedPartner,
  SessionContext,
  SessionKind,
  Side,
} from './types'

const uuid = z.uuid()

// PostgREST: the function does not exist. Until 20261009000190_blind_dating.sql is applied the app
// falls back to the old random-chat RPCs, so a deploy before `supabase db push` keeps working.
// TODO: remove the fallbacks once the migration is live everywhere.
const MISSING_RPC = 'PGRST202'

// Explicit keys (not Object.fromEntries over LOCALES) so the parsed shape is Record<Locale, …>.
const localeRecord = z.object({ en: z.string(), ms: z.string(), ru: z.string() })
const localeLists = z.object({
  en: z.array(z.string()),
  ms: z.array(z.string()),
  ru: z.array(z.string()),
})

const photoSchema = z
  .object({ path: z.string(), width: z.number(), height: z.number() })
  .nullable()
  .catch(null)

// session_context (20261009000220). Unknown shapes become "no context" instead of breaking a chat.
const contextSchema = z
  .union([
    z.object({
      post_id: z.uuid().nullable(),
      body: z.string().nullable(),
      i_am_author: z.boolean(),
      author: z
        .object({
          id: z.uuid(),
          display_name: z.string(),
          username: z.string().nullable().catch(null),
          age: z.number().nullable().catch(null),
          verified: z.boolean().catch(false),
          photo: photoSchema,
        })
        .nullable()
        .catch(null),
      author_pseudonym: z.tuple([z.number(), z.number(), z.number()]).nullable().catch(null),
    }),
    z.object({
      prompt_id: z.uuid(),
      question: localeRecord,
      options: localeLists,
      my_option: z.number().nullable(),
      partner_option: z.number().nullable(),
    }),
  ])
  .nullable()
  .catch(null)

// Columns from 20261009000220 are optional: before that migration get_blind_session has no
// kind / context / counts, and every session is a blind date.
const sessionSchema = z.object({
  id: z.uuid(),
  my_side: z.enum(['a', 'b']),
  my_alias: z.number().int(),
  partner_alias: z.number().int(),
  my_decision: z.boolean().nullable(),
  state: z.enum(['active', 'matched', 'passed', 'ended']),
  common_tags: z.array(z.string()).nullable(),
  partner: z.unknown(),
  match_id: z.uuid().nullable(),
  kind: z.enum(['blind', 'post', 'prompt']).catch('blind'),
  context: contextSchema,
  my_messages: z.number().int().catch(0),
  partner_messages: z.number().int().catch(0),
  revealed_from_start: z.boolean().catch(false),
})

const decideSchema = z.object({
  state: z.enum(['waiting', 'matched', 'passed', 'ended']),
  match_id: z.uuid().nullable(),
  just_matched: z.boolean().optional(),
})

const startSchema = z.object({
  session_id: z.uuid(),
  message_id: z.uuid().nullable().optional(),
  created: z.boolean(),
  state: z.enum(['active', 'matched', 'passed', 'ended']),
})

const previewSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['post', 'prompt']),
  my_side: z.enum(['a', 'b']),
  partner_alias: z.number().int(),
  context: contextSchema,
  partner: z
    .object({ id: z.uuid(), display_name: z.string(), age: z.number(), photo: photoSchema })
    .nullable()
    .catch(null),
  revealed_from_start: z.boolean(),
  last_body: z.string().nullable(),
  last_at: z.string().nullable(),
  last_mine: z.boolean().nullable(),
  started_at: z.string(),
})

// Postgres errors raised by the conversation RPCs (20261009000220).
function conversationError(code: string | undefined): ErrorKey {
  if (code === 'P0429') return 'conversationLimit'
  if (code === 'VS001') return 'muted'
  if (code === 'P0423') return 'revealLocked'
  if (code === 'P0002' || code === MISSING_RPC) return 'conversationUnavailable'
  if (code === '42501') return 'unauthorized'
  return 'generic'
}

// Main photo of a partner who is already revealed (matched, or a prompt conversation): signed,
// short-lived URL.
async function revealedPartner(raw: unknown): Promise<RevealedPartner | null> {
  const parsed = partnerSchema.safeParse(raw)
  if (!parsed.success) return null
  const p = parsed.data
  const supabase = await createClient()
  const { data: photo } = await supabase
    .from('profile_photos')
    .select('storage_path, width, height')
    .eq('profile_id', p.id)
    .order('position')
    .limit(1)
    .maybeSingle()
  const url = photo && (await signPhotoPaths([photo.storage_path])).get(photo.storage_path)
  return {
    id: p.id,
    name: p.display_name,
    age: p.age,
    city: p.city,
    bio: p.bio,
    relationshipGoal: p.relationship_goal,
    jobTitle: p.job_title,
    photo: url && photo ? { url, width: photo.width, height: photo.height } : null,
  }
}

// The pinned context of a post / prompt conversation; the author's photo (an "As me" post the
// viewer may see) is signed with the viewer's own client.
async function toContext(raw: z.infer<typeof contextSchema>): Promise<SessionContext> {
  if (!raw) return null
  if ('prompt_id' in raw) {
    return {
      kind: 'prompt',
      promptId: raw.prompt_id,
      question: raw.question,
      options: raw.options,
      myOption: raw.my_option,
      partnerOption: raw.partner_option,
    }
  }
  const a = raw.author
  const photoUrl = a?.photo && (await signPhotoPaths([a.photo.path])).get(a.photo.path)
  const ps = raw.author_pseudonym
  return {
    kind: 'post',
    postId: raw.post_id,
    body: raw.body,
    iAmAuthor: raw.i_am_author,
    author: a
      ? {
          id: a.id,
          name: a.display_name,
          username: a.username,
          age: a.age,
          verified: a.verified,
          photoUrl: photoUrl || null,
        }
      : null,
    authorPseudonym: ps ? toPseudonym(ps[0], ps[1], ps[2]) : null,
  }
}

async function toSession(s: z.infer<typeof sessionSchema>): Promise<BlindSession> {
  const showPartner = s.state === 'matched' || s.revealed_from_start
  const [partner, context] = await Promise.all([
    showPartner && s.partner ? revealedPartner(s.partner) : null,
    toContext(s.context),
  ])
  return {
    id: s.id,
    kind: s.kind,
    mySide: s.my_side,
    myAlias: s.my_alias,
    partnerAlias: s.partner_alias,
    myDecision: s.my_decision,
    state: s.state,
    commonTags: s.common_tags ?? [],
    partner,
    matchId: s.state === 'matched' ? s.match_id : null,
    context,
    myMessages: s.my_messages,
    partnerMessages: s.partner_messages,
    revealedFromStart: s.revealed_from_start,
  }
}

// The caller's active blind date, or (with an id) that session in any state, e.g. to show the
// reveal after a match or to open a private reply. Profile data is only present once both people
// pressed Connect (or from the start for prompt conversations).
export async function getBlindSession(sessionId?: string): Promise<BlindSession | null> {
  if (sessionId !== undefined && !uuid.safeParse(sessionId).success) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_blind_session', { p_session: sessionId })
  if (error?.code === MISSING_RPC) return legacySession()
  const parsed = sessionSchema.safeParse(data?.[0])
  if (!parsed.success) return null
  return toSession(parsed.data)
}

// Returns the session if paired right away, or null while waiting in the queue.
export async function joinBlind(filters: JoinFilters): Promise<UserResult<BlindSession | null>> {
  const parsed = joinSchema.safeParse(filters)
  if (!parsed.success) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('randomizer_join', {
    p_genders: parsed.data.genders,
    p_min_age: parsed.data.minAge,
    p_max_age: parsed.data.maxAge,
    p_tags: parsed.data.tagIds,
  })
  if (error) return fail(error.code === '42501' ? 'unauthorized' : 'generic')
  return ok(data ? await getBlindSession() : null)
}

export async function pingBlind(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('randomizer_ping')
}

export async function leaveBlind(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('randomizer_leave')
}

export async function loadBlindMessages(sessionId: string): Promise<BlindMessage[]> {
  if (!uuid.safeParse(sessionId).success) return []
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_random_messages', {
    p_session_id: sessionId,
    p_limit: 100,
  })
  return (data ?? [])
    .map((m) => ({ id: m.id, body: m.body, mine: m.is_mine, createdAt: m.created_at }))
    .reverse()
}

// `notify`: a post / prompt conversation, whose partner is usually not on the page: the server
// sends them a (throttled) push. Blind dates never push (both people are present).
export async function sendBlind(
  sessionId: string,
  raw: string,
  notify = false,
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
  if (notify === true) notifyConversationMessage(data)
  return ok({ id: data, body, mine: true, createdAt: new Date().toISOString() })
}

// Connect (true) or Pass (false). On the Connect that completes the match, the other person (who
// connected first and may have closed the app) gets a push.
export async function decideBlind(
  sessionId: string,
  connect: boolean,
): Promise<UserResult<DecideResult>> {
  if (!uuid.safeParse(sessionId).success) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('blind_decide', {
    p_session: sessionId,
    p_connect: connect,
  })
  if (error?.code === MISSING_RPC) return legacyDecide(sessionId, connect)
  if (error) return fail(error.code === 'P0423' ? 'revealLocked' : 'generic')
  const parsed = decideSchema.safeParse(data)
  if (!parsed.success) return fail('generic')
  const { state, match_id: matchId, just_matched: justMatched } = parsed.data
  if (state === 'matched' && justMatched) {
    const session = await getBlindSession(sessionId)
    if (session?.partner) notifyBlindMatch(session.partner.id, matchId)
  }
  return ok({ state, matchId })
}

// Blocks the other person without revealing who they are; ends the session.
export async function blockBlind(sessionId: string): Promise<UserResult> {
  if (!uuid.safeParse(sessionId).success) return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('blind_block', { p_session: sessionId })
  if (error) return fail('generic')
  return ok(undefined)
}

// How many other people are waiting in the queue right now (counts only, no identities).
export async function getBlindStats(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('randomizer_stats')
  const count = z.number().int().nonnegative().safeParse(data)
  return count.success ? count.data : 0
}

// ---- Reply privately / Say hi (20261009000220) ------------------------------------------------

// Starts (or continues) the caller's private conversation on a post with its author, sending the
// first message. The author gets a push after the response; the caller never learns who they are.
export async function startPostConversation(
  postId: string,
  raw: string,
): Promise<UserResult<{ sessionId: string; state: BlindState }>> {
  if (!uuid.safeParse(postId).success) return fail('invalidInput')
  const body = sanitizeText(z.string().parse(raw))
  if (!body) return fail('messageEmpty')
  if (body.length > 1000) return fail('messageTooLong')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_post_conversation', {
    p_post: postId,
    p_body: body,
  })
  if (error) return fail(conversationError(error.code))
  const parsed = startSchema.safeParse(data)
  if (!parsed.success) return fail('generic')
  if (parsed.data.message_id) notifyConversationMessage(parsed.data.message_id)
  return ok({ sessionId: parsed.data.session_id, state: parsed.data.state })
}

// "Say hi" from the question of the day: a conversation with someone who chose the same answer.
export async function startPromptConversation(
  promptId: string,
  targetId: string,
): Promise<UserResult<{ sessionId: string; state: BlindState }>> {
  if (!uuid.safeParse(promptId).success || !uuid.safeParse(targetId).success) {
    return fail('invalidInput')
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_prompt_conversation', {
    p_prompt: promptId,
    p_target: targetId,
  })
  if (error) return fail(conversationError(error.code))
  const parsed = startSchema.safeParse(data)
  if (!parsed.success) return fail('generic')
  return ok({ sessionId: parsed.data.session_id, state: parsed.data.state })
}

// The caller's open post / prompt conversations (Chats screen). Empty until the migration is live.
export async function listMyConversations(): Promise<ConversationPreview[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_my_conversations')
  if (error || !data) return []
  const rows = data.flatMap((r) => {
    const p = previewSchema.safeParse(r)
    return p.success ? [p.data] : []
  })
  const paths = rows.flatMap((r) => (r.partner?.photo ? [r.partner.photo.path] : []))
  const urls = await signPhotoPaths([...new Set(paths)])
  return Promise.all(
    rows.map(async (r) => {
      const ph = r.partner?.photo
      const url = ph && urls.get(ph.path)
      return {
        id: r.id,
        kind: r.kind,
        partnerAlias: r.partner_alias,
        context: await toContext(r.context),
        partner: r.partner
          ? {
              id: r.partner.id,
              name: r.partner.display_name,
              age: r.partner.age,
              photo: ph && url ? { url, width: ph.width, height: ph.height } : null,
            }
          : null,
        lastBody: r.last_body,
        lastAt: r.last_at,
        lastMine: r.last_mine ?? false,
        startedAt: r.started_at,
      }
    }),
  )
}

// ---- Fallback to the pre-20261009000190 RPCs (see MISSING_RPC) --------------------------------

// Server-side alias from the session id, stable per session and different for the two sides.
function legacyAlias(id: string, side: Side): number {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const a = 100 + ((h >>> 0) % 900)
  const b = a === 999 ? 100 : a + 1 + ((h >>> 10) % (999 - a))
  return side === 'a' ? a : b
}

async function legacySession(): Promise<BlindSession | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_random_session')
  const s = data?.[0]
  if (!s) return null
  const mySide: Side = s.my_side === 'a' ? 'a' : 'b'
  const partner = s.partner ? await revealedPartner(s.partner) : null
  const state: BlindState = partner ? 'matched' : 'active'
  const kind: SessionKind = 'blind'
  return {
    id: s.id,
    kind,
    mySide,
    myAlias: legacyAlias(s.id, mySide),
    partnerAlias: legacyAlias(s.id, mySide === 'a' ? 'b' : 'a'),
    myDecision: s.my_revealed ? true : null,
    state,
    commonTags: s.common_tags ?? [],
    partner,
    matchId: partner ? s.match_id : null,
    context: null,
    myMessages: 0,
    partnerMessages: 0,
    revealedFromStart: false,
  }
}

async function legacyDecide(
  sessionId: string,
  connect: boolean,
): Promise<UserResult<DecideResult>> {
  const supabase = await createClient()
  if (!connect) {
    await supabase.rpc('randomizer_end', { p_session_id: sessionId })
    return ok({ state: 'passed', matchId: null })
  }
  const { data: mutual, error } = await supabase.rpc('randomizer_reveal', {
    p_session_id: sessionId,
  })
  if (error) return ok({ state: 'ended', matchId: null })
  if (!mutual) return ok({ state: 'waiting', matchId: null })
  const session = await legacySession()
  return ok({ state: 'matched', matchId: session?.matchId ?? null })
}
