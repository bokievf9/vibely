'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getViewer } from '@/features/auth/session'
import { signPhotoPaths } from '@/features/profile/queries'
import { notifyNewMatch, notifyReferral, notifyReferralWorked } from '@/features/push/send'
import { normalizeNote } from './card'
import { getIntroducible } from './queries'
import { createSchema, createdSchema, decidedSchema, rawCardSchema, type RawCard } from './schemas'
import type { CardPerson, Decision, Introducible, ReferralCard } from './types'

// SQLSTATEs raised by create_referral / decide_referral (20261009000240).
const REFERRAL_ERRORS: Record<string, ErrorKey> = {
  VM001: 'referralExists',
  VM002: 'referralUnavailable',
  VM003: 'notFound',
}

const referralError = (code: string | undefined): ErrorKey =>
  (code ? REFERRAL_ERRORS[code] : undefined) ?? rateLimitedOr(code, 'generic')

// Candidates for "Introduce to a friend" in the chat with `partnerId`.
export async function loadIntroducible(partnerId: string): Promise<Introducible[]> {
  const id = z.uuid().safeParse(partnerId)
  const viewer = await getViewer()
  if (!id.success || !viewer) return []
  return getIntroducible(viewer.id, id.data)
}

// A introduces the chat partner (B) to another match (C). The database checks every rule; the
// card lands in the A-B chat and B gets a push.
export async function createReferral(input: {
  partnerId: string
  otherId: string
  note?: string
}): Promise<UserResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const note = normalizeNote(sanitizeText(parsed.data.note ?? ''))
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_referral', {
    p_b: parsed.data.partnerId,
    p_c: parsed.data.otherId,
    p_note: note || null,
  })
  if (error) return fail(referralError(error.code))
  const created = createdSchema.safeParse(data)
  if (!created.success) return fail('generic')
  notifyReferral(parsed.data.partnerId, viewer.profile?.displayName ?? 'Vibely', created.data.match_id)
  return ok({ id: created.data.id })
}

async function toPerson(raw: RawCard['person']): Promise<CardPerson | null> {
  if (!raw) return null
  const url = raw.photo ? (await signPhotoPaths([raw.photo.path])).get(raw.photo.path) : null
  return {
    id: raw.id,
    name: raw.name,
    age: raw.age,
    photo: raw.photo && url ? { url, width: raw.photo.width, height: raw.photo.height } : null,
  }
}

// The card behind a 'referral' (or 'system') message. `null` when the caller may not see it or
// it no longer exists (deleted after 90 days, migration not applied).
export async function loadReferralCard(referralId: string): Promise<ReferralCard | null> {
  const id = z.uuid().safeParse(referralId)
  if (!id.success || !(await getViewer())) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_referral_card', { p_id: id.data })
  if (error || !data) return null
  const parsed = rawCardSchema.safeParse(data)
  if (!parsed.success) return null
  const raw = parsed.data
  const base = {
    id: raw.id,
    state: raw.state,
    note: raw.note,
    matchmakerName: raw.matchmaker_name,
  }
  if (raw.role === 'matchmaker') {
    const [b, c] = await Promise.all([toPerson(raw.b ?? null), toPerson(raw.c ?? null)])
    return { ...base, role: 'matchmaker', b, c }
  }
  return {
    ...base,
    role: raw.role,
    person: await toPerson(raw.person ?? null),
    matchId: raw.match_id,
  }
}

const decideInput = z.object({ referralId: z.uuid(), interested: z.boolean() })

// Interested / No thanks. Pushes: C is told when B is interested; when the match is created,
// B gets the regular new-match push and the matchmaker "Your introduction worked".
export async function decideReferral(input: {
  referralId: string
  interested: boolean
}): Promise<UserResult<Decision>> {
  const parsed = decideInput.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('decide_referral', {
    p_id: parsed.data.referralId,
    p_interested: parsed.data.interested,
  })
  if (error) return fail(referralError(error.code))
  const result = decidedSchema.safeParse(data)
  if (!result.success) return fail('generic')
  const { state, match_id: matchId, just_matched: justMatched, notify } = result.data
  if (state === 'interested' && notify?.user_id && notify.match_id) {
    notifyReferral(notify.user_id, notify.matchmaker_name ?? 'Vibely', notify.match_id)
  }
  if (state === 'matched' && justMatched && matchId && notify) {
    if (notify.b_id) notifyNewMatch(notify.b_id, notify.c_name ?? '', matchId)
    if (notify.matchmaker_id) {
      notifyReferralWorked(notify.matchmaker_id, notify.b_name ?? '', notify.c_name ?? '')
    }
  }
  return ok({ state, matchId: matchId ?? null })
}
