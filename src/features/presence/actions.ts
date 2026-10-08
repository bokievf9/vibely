'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'

// Heartbeat while the app is open (also throttled in the database).
export async function touchPresence(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('touch_last_active')
}

const timestamp = z.iso.datetime({ offset: true }).nullable()

// The match partner's last activity, or null when either side hides it.
export async function getPartnerLastSeen(matchId: string): Promise<UserResult<string | null>> {
  const id = z.uuid().safeParse(matchId)
  if (!id.success) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('match_partner_last_seen', { p_match: id.data })
  const parsed = timestamp.safeParse(data ?? null)
  return error || !parsed.success ? fail('generic') : ok(parsed.data)
}

export async function setShowLastSeen(show: boolean): Promise<UserResult> {
  const value = z.boolean().safeParse(show)
  const viewer = await getViewer()
  if (!value.success) return fail('invalidInput')
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ show_last_seen: value.data })
    .eq('id', viewer.id)
  return error ? fail('generic') : ok(undefined)
}
