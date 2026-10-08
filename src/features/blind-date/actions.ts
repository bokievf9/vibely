'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import { signPhotoPaths } from '@/features/profile/queries'
import { notifyBlindMatch } from '@/features/push/send'
import { joinSchema, partnerSchema, type JoinFilters } from './schemas'
import type {
  BlindMessage,
  BlindSession,
  BlindState,
  DecideResult,
  RevealedPartner,
  Side,
} from './types'

const uuid = z.uuid()

// PostgREST: the function does not exist. Until 20261009000190_blind_dating.sql is applied the app
// falls back to the old random-chat RPCs, so a deploy before `supabase db push` keeps working.
// TODO: remove the fallbacks once the migration is live everywhere.
const MISSING_RPC = 'PGRST202'

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
})

const decideSchema = z.object({
  state: z.enum(['waiting', 'matched', 'passed', 'ended']),
  match_id: z.uuid().nullable(),
  just_matched: z.boolean().optional(),
})

// Main photo of a partner who is already revealed (matched): signed, short-lived URL.
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

// The caller's active blind date, or (with an id) that session in any state, e.g. to show the
// reveal after a match. Profile data is only present once both people pressed Connect.
export async function getBlindSession(sessionId?: string): Promise<BlindSession | null> {
  if (sessionId !== undefined && !uuid.safeParse(sessionId).success) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_blind_session', { p_session: sessionId })
  if (error?.code === MISSING_RPC) return legacySession()
  const parsed = sessionSchema.safeParse(data?.[0])
  if (!parsed.success) return null
  const s = parsed.data
  const partner = s.state === 'matched' && s.partner ? await revealedPartner(s.partner) : null
  return {
    id: s.id,
    mySide: s.my_side,
    myAlias: s.my_alias,
    partnerAlias: s.partner_alias,
    myDecision: s.my_decision,
    state: s.state,
    commonTags: s.common_tags ?? [],
    partner,
    matchId: s.state === 'matched' ? s.match_id : null,
  }
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

export async function sendBlind(sessionId: string, raw: string): Promise<UserResult<BlindMessage>> {
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
  if (error) return fail('generic')
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
  return {
    id: s.id,
    mySide,
    myAlias: legacyAlias(s.id, mySide),
    partnerAlias: legacyAlias(s.id, mySide === 'a' ? 'b' : 'a'),
    myDecision: s.my_revealed ? true : null,
    state,
    commonTags: s.common_tags ?? [],
    partner,
    matchId: partner ? s.match_id : null,
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
