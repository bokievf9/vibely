'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { signPhotoPaths } from '@/features/profile/queries'
import { notifyCrushMatch } from '@/features/push/send'

const photoSchema = z.object({ path: z.string(), width: z.number(), height: z.number() }).nullable()

export type CrushInviteResult = { code: string } | { error: 'limit' | 'unavailable' | 'generic' }

// A single-use invite link with the crush flag (migration 20261009000250). The inviter shares
// it themselves: no contact details of the invitee ever reach the server.
export async function createCrushInvite(): Promise<CrushInviteResult> {
  if (!(await getViewer())) return { error: 'generic' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_referral_invite', { p_crush: true })
  if (error) {
    if (error.message.includes('crush_limit') || error.message.includes('invite_limit')) {
      return { error: 'limit' }
    }
    // PGRST202: the database predates the migration.
    return { error: error.code === 'PGRST202' ? 'unavailable' : 'generic' }
  }
  return data ? { code: data } : { error: 'generic' }
}

export type PendingCrush = {
  inviterId: string
  name: string
  age: number
  photo: { url: string; width: number; height: number } | null
  // Both want each other's gender: only then does the card offer "Yes" (a match).
  compatible: boolean
}

// The invitee's one-time card, or null (nothing pending, not verified yet, or the feature does
// not exist on this database). Everything is decided in get_pending_crush().
export async function loadPendingCrush(): Promise<PendingCrush | null> {
  if (!(await getViewer())) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_pending_crush')
  const row = data?.[0]
  if (error || !row) return null
  const photo = photoSchema.catch(null).parse(row.photo)
  const urls = await signPhotoPaths(photo ? [photo.path] : [])
  const url = photo && urls.get(photo.path)
  return {
    inviterId: row.inviter_id,
    name: row.display_name,
    age: row.age,
    photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
    compatible: row.compatible,
  }
}

const answerSchema = z.boolean().nullable()

// Records the answer once. Yes creates the match (both likes, like a mutual swipe) when both
// are verified and compatible; the inviter is then told. No (or a dismissal) tells nobody.
export async function answerCrush(
  yes: boolean | null,
): Promise<UserResult<{ matchId: string | null }>> {
  const parsed = answerSchema.safeParse(yes)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('answer_crush', { p_yes: parsed.data as boolean })
  const row = data?.[0]
  if (error || !row) return fail(error?.code === '42501' ? 'unauthorized' : 'generic')
  if (row.match_id) {
    notifyCrushMatch(row.inviter_id, viewer.profile?.displayName ?? '', row.match_id)
  }
  return ok({ matchId: row.match_id ?? null })
}
