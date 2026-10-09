'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getCurrentEvent } from './queries'
import type { CurrentEvent } from './types'

// Polled by the widgets (countdown reaching zero, people in the room while live).
export async function fetchCurrentEvent(): Promise<CurrentEvent | null> {
  return getCurrentEvent()
}

const remindSchema = z.object({ eventId: z.uuid(), on: z.boolean() })

// "Remind me" for an upcoming night: a push 15 minutes before and one when it starts.
export async function remindEvent(eventId: string, on: boolean): Promise<UserResult<boolean>> {
  const parsed = remindSchema.safeParse({ eventId, on })
  if (!parsed.success) return fail('invalidInput')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('event_remind', {
    p_event: parsed.data.eventId,
    p_on: parsed.data.on,
  })
  if (error) {
    if (error.code === '42501') return fail('unauthorized')
    if (error.code === 'P0002') return fail('eventNotLive')
    return fail('generic')
  }
  return ok(data === true)
}
