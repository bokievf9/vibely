'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import { signPhotoPaths } from '@/features/profile/queries'
import { notifyRandomReveal } from '@/features/push/send'
import { joinSchema, partnerSchema, type JoinFilters } from './schemas'
import type { RandomMessage, RandomSession, RevealedPartner } from './types'

const uuid = z.uuid()

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

export async function getRandomSession(): Promise<RandomSession | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_random_session')
  const s = data?.[0]
  if (!s) return null
  return {
    id: s.id,
    mySide: s.my_side === 'a' ? 'a' : 'b',
    myRevealed: s.my_revealed,
    partnerRevealed: s.partner_revealed,
    commonTags: s.common_tags ?? [],
    partner: s.partner ? await revealedPartner(s.partner) : null,
    matchId: s.match_id,
  }
}

// Returns the session if paired right away, or null while waiting in the queue.
export async function joinRandom(filters: JoinFilters): Promise<UserResult<RandomSession | null>> {
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
  return ok(data ? await getRandomSession() : null)
}

export async function pingRandom(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('randomizer_ping')
}

export async function leaveRandom(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('randomizer_leave')
}

export async function loadRandomMessages(sessionId: string): Promise<RandomMessage[]> {
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

export async function sendRandom(
  sessionId: string,
  raw: string,
): Promise<UserResult<RandomMessage>> {
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

export async function revealRandom(sessionId: string): Promise<UserResult<RandomSession | null>> {
  if (!uuid.safeParse(sessionId).success) return fail('invalidInput')
  const supabase = await createClient()
  // Repeated taps also return true: only the consent that completes the reveal notifies.
  const { data: before } = await supabase.rpc('get_random_session')
  const current = before?.[0]
  const alreadyRevealed = current?.id === sessionId ? current.my_revealed : true
  const { data: mutual, error } = await supabase.rpc('randomizer_reveal', {
    p_session_id: sessionId,
  })
  if (error) return fail('generic')
  const session = await getRandomSession()
  if (mutual === true && !alreadyRevealed && session?.partner)
    notifyRandomReveal(session.partner.id, session.matchId)
  return ok(session)
}

export async function endRandom(sessionId: string): Promise<void> {
  if (!uuid.safeParse(sessionId).success) return
  const supabase = await createClient()
  await supabase.rpc('randomizer_end', { p_session_id: sessionId })
}

// How many other people are waiting in the queue right now (counts only, no identities).
export async function getRandomStats(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('randomizer_stats')
  const count = z.number().int().nonnegative().safeParse(data)
  return count.success ? count.data : 0
}
