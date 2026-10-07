'use server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { blockSchema, reportSchema, type ReportInput } from './schemas'

// Reports land in the admin panel (/admin/reports). The reason code is stored in English
// so moderators see the same category whatever language the reporter uses.
export async function report(input: ReportInput): Promise<UserResult> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')

  const { targetType, targetId, reason, details } = parsed.data
  const text = [reason, sanitizeText(details)].filter(Boolean).join(': ')
  const supabase = await createClient()
  const { error } = await supabase
    .from('reports')
    .insert({ target_type: targetType, target_id: targetId, reason: text })
  if (error) return fail(error.code === '23505' ? 'alreadyReported' : 'generic')
  return ok(undefined)
}

// Blocking hides both users from each other everywhere and removes their match (and chat).
export async function block(input: { userId: string }): Promise<UserResult> {
  const parsed = blockSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  if (viewer.id === parsed.data.userId) return fail('invalidInput')

  const supabase = await createClient()
  const { error } = await supabase.from('blocks').insert({ blocked_id: parsed.data.userId })
  if (error && error.code !== '23505') return fail('generic')

  const [a, b] = [viewer.id, parsed.data.userId].sort()
  await supabase
    .from('matches')
    .delete()
    .eq('user_a', a ?? '')
    .eq('user_b', b ?? '')
  return ok(undefined)
}
