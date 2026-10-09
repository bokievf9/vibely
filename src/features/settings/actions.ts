'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { notificationTypeSchema, type NotificationType } from '@/features/push/prefs'
import { planFail } from '@/features/plans/errors'

// Pause = hidden from Discover, "Who liked you" and the blind date queue; matches keep working.
export async function setDiscoverable(discoverable: boolean): Promise<UserResult> {
  const value = z.boolean().safeParse(discoverable)
  if (!value.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ discoverable: value.data })
    .eq('id', viewer.id)
  return error ? fail('generic') : ok(undefined)
}

// Incognito: shown in Discover only to people the user liked; hidden from search, crossed paths
// and "Who liked you" (enforced in the database, 20261009000240). Switching it on needs Plus
// (VP402, 20261009000280); switching off is always allowed.
export async function setIncognito(on: boolean): Promise<UserResult> {
  const value = z.boolean().safeParse(on)
  if (!value.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ is_incognito: value.data })
    .eq('id', viewer.id)
  return error ? (planFail(error) ?? fail('generic')) : ok(undefined)
}

const prefSchema = z.object({ type: notificationTypeSchema, enabled: z.boolean() })

export async function setNotificationPref(
  type: NotificationType,
  enabled: boolean,
): Promise<UserResult> {
  const parsed = prefSchema.safeParse({ type, enabled })
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  // user_id defaults to auth.uid(); RLS limits the row to the caller.
  const { error } = await supabase
    .from('notification_prefs')
    .upsert({ [parsed.data.type]: parsed.data.enabled }, { onConflict: 'user_id' })
  return error ? fail('generic') : ok(undefined)
}

// RLS ("blocks: remove own") limits the delete to the caller's own blocks.
export async function unblockUser(userId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(userId)
  if (!id.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', viewer.id)
    .eq('blocked_id', id.data)
  return error ? fail('generic') : ok(undefined)
}
