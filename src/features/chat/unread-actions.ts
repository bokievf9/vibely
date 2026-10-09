'use server'

import { z } from 'zod'
import { createClient, dropDeadSession } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'

// groups: Duo group chats exist on this database (their messages count too).
export type UnreadSummary = { userId: string; count: number; groups: boolean }

const countSchema = z.number().int().nonnegative()

// Total unread messages across the caller's matches (bottom-nav badge). The user id names the
// caller's own private Realtime topic inbox:<user id>.
export async function getUnreadSummary(): Promise<UserResult<UnreadSummary>> {
  const supabase = await createClient()
  const { data: claims, error: authError } = await supabase.auth.getClaims()
  if (await dropDeadSession(authError)) return fail('unauthorized')
  const userId = z.uuid().safeParse(claims?.claims.sub)
  if (!userId.success) return fail('unauthorized')
  const [{ data, error }, group] = await Promise.all([
    supabase.rpc('unread_message_count'),
    // Duo group chats (20261009000261); absent before the migration: 0.
    supabase.rpc('group_unread_count'),
  ])
  const count = countSchema.safeParse(data)
  if (error || !count.success) return fail('generic')
  const groupCount = countSchema.safeParse(group.data)
  return ok({
    userId: userId.data,
    count: count.data + (groupCount.success ? groupCount.data : 0),
    groups: !group.error,
  })
}
