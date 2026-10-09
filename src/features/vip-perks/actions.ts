'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getViewer } from '@/features/auth/session'
import { notifyNewLike, notifyNewMatch } from '@/features/push/send'
import { NOTE_MAX } from './types'

// Settings → Privacy. Off: nobody sees when the viewer read their messages, and the viewer sees
// nobody's read state either.
export async function setSendReadReceipts(send: boolean): Promise<UserResult> {
  if (typeof send !== 'boolean') return fail('invalidInput')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_read_receipts', { p_send: send })
  return error ? fail(error.code === '42501' ? 'unauthorized' : 'generic') : ok(undefined)
}

// The viewer opened someone's profile (profile page or "More" on a card). Fire and forget: the
// database decides whether it counts (not self, staff, incognito, blocked, shadow-banned).
export async function recordProfileVisit(userId: string): Promise<void> {
  const id = z.uuid().safeParse(userId)
  if (!id.success) return
  const supabase = await createClient()
  await supabase.rpc('record_profile_visit', { p_target: id.data })
}

const noteSchema = z.object({
  targetId: z.uuid(),
  body: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'messageEmpty').max(NOTE_MAX, 'noteTooLong')),
})

export type NoteResult = { matchId: string | null; held: boolean }

// VP402 (plans): hint 'limit' = today's note is used, otherwise the plan lacks the perk.
function noteError(error: { code?: string; hint?: string | null }): ErrorKey {
  if (error.code === 'VP402') return error.hint === 'limit' ? 'noteLimitReached' : 'perkRequired'
  if (error.code === '23505') return 'noteAlreadySent'
  if (error.code === '22023') return 'noteUnavailable'
  if (error.code === '42501') return 'unauthorized'
  return rateLimitedOr(error.code, 'generic')
}

const resultSchema = z.object({ state: z.string(), match_id: z.string().nullable() })

// "Like with a note" (VIP, one a day): the like and the note in one call. A mutual like opens the
// match with the note as its first message.
export async function sendLikeNote(
  input: z.input<typeof noteSchema>,
): Promise<UserResult<NoteResult>> {
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message
    return fail(key === 'noteTooLong' || key === 'messageEmpty' ? key : 'invalidInput')
  }
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('send_like_note', {
    p_target: parsed.data.targetId,
    p_body: sanitizeText(parsed.data.body),
  })
  if (error) return fail(noteError(error))
  const result = resultSchema.safeParse(data)
  if (!result.success) return fail('generic')
  const matchId = result.data.match_id
  await supabase.rpc('touch_last_active')
  if (matchId) notifyNewMatch(parsed.data.targetId, viewer.profile?.displayName ?? '', matchId)
  else notifyNewLike(parsed.data.targetId, viewer.id)
  return ok({ matchId, held: result.data.state === 'held' })
}
