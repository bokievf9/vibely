'use server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, rateLimitedOr, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { getStatuses, parseOwnStatus } from './queries'
import { statusInputSchema, type StatusInput } from './schemas'
import type { OwnStatus, StatusesState } from './types'

// The carousel (and own status) for a client refresh after posting or replying.
export async function loadStatuses(): Promise<StatusesState> {
  return getStatuses()
}

// Sets (replaces) the status for 3 hours; with a quick pick the 24-hour plan is set too.
// Replies go through startStatusConversation (blind-date actions, the conversation engine).
export async function setStatus(input: StatusInput): Promise<UserResult<OwnStatus>> {
  const parsed = statusInputSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  if (!(await getViewer())) return fail('unauthorized')
  const text = sanitizeText(parsed.data.text)
  if (!text) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_status', {
    p_emoji: parsed.data.emoji,
    p_text: text,
    p_plan_tag: parsed.data.planTag ?? undefined,
  })
  if (error)
    return fail(error.code === '42501' ? 'unauthorized' : rateLimitedOr(error.code, 'generic'))
  const own = parseOwnStatus(data)
  return own ? ok(own) : fail('generic')
}

export async function clearStatus(): Promise<UserResult> {
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('clear_status')
  return error ? fail('generic') : ok(undefined)
}
