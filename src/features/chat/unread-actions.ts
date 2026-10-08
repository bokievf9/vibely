'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'

export type UnreadSummary = { userId: string; count: number }

const countSchema = z.number().int().nonnegative()

// Total unread messages across the caller's matches (bottom-nav badge). The user id names the
// caller's own private Realtime topic inbox:<user id>.
export async function getUnreadSummary(): Promise<UserResult<UnreadSummary>> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = z.uuid().safeParse(claims?.claims.sub)
  if (!userId.success) return fail('unauthorized')
  const { data, error } = await supabase.rpc('unread_message_count')
  const count = countSchema.safeParse(data)
  if (error || !count.success) return fail('generic')
  return ok({ userId: userId.data, count: count.data })
}
