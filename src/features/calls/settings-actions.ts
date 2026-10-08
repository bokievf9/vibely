'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { callErrorKey } from './errors'
import { getCallHistory, getCallSettings } from './queries'
import { callPermissionSchema } from './schemas'
import { callsEnabled } from './server/env'
import type { CallEntry, CallSettings } from './types'

// The user read and accepted "Calls are recorded and stored for up to 90 days for safety".
export async function acceptCallsNotice(): Promise<UserResult> {
  if (!callsEnabled()) return fail('callsDisabled')
  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_calls_notice')
  return error ? fail('generic') : ok(undefined)
}

// "Allow calls in this chat" on/off. Returns the updated settings.
export async function setCallsAllowed(
  input: z.input<typeof callPermissionSchema>,
): Promise<UserResult<CallSettings>> {
  const parsed = callPermissionSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  if (!callsEnabled()) return fail('callsDisabled')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_call_permission', {
    p_match: parsed.data.matchId,
    p_allowed: parsed.data.allowed,
  })
  if (error) return fail(callErrorKey(error.code))
  const settings = await getCallSettings(parsed.data.matchId)
  return settings ? ok(settings) : fail('notFound')
}

export async function loadCallSettings(matchId: string): Promise<UserResult<CallSettings>> {
  const id = z.uuid().safeParse(matchId)
  if (!id.success) return fail('invalidInput')
  const settings = await getCallSettings(id.data)
  return settings ? ok(settings) : fail('notFound')
}

export async function loadCallHistory(matchId: string): Promise<UserResult<CallEntry[]>> {
  const id = z.uuid().safeParse(matchId)
  const viewer = await getViewer()
  if (!id.success || !viewer) return fail('invalidInput')
  return ok(await getCallHistory(id.data, viewer.id))
}
