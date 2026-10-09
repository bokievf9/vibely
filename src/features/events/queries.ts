import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { CurrentEvent } from './types'

// PostgREST: the function does not exist. Until 20261009000210_events.sql is applied there are
// no events: the widgets simply do not render.
const MISSING_RPC = 'PGRST202'

const rowSchema = z.object({
  id: z.uuid(),
  title_en: z.string(),
  title_ms: z.string(),
  title_ru: z.string(),
  theme: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(['scheduled', 'live']),
  in_room: z.number().int().nonnegative(),
  joined: z.number().int().nonnegative(),
  reminded: z.boolean(),
  server_now: z.string(),
})

// The live Blind Dating Night, or the next scheduled one; null when there is none (or the
// migration is not live yet). Reads cookies: call inside a <Suspense> boundary.
export async function getCurrentEvent(): Promise<CurrentEvent | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_current_event')
  if (error) {
    if (error.code !== MISSING_RPC) console.error('[events] get_current_event', error.message)
    return null
  }
  const parsed = rowSchema.safeParse(data?.[0])
  if (!parsed.success) return null
  const e = parsed.data
  return {
    id: e.id,
    title: { en: e.title_en, ms: e.title_ms, ru: e.title_ru },
    theme: e.theme,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    status: e.status,
    inRoom: e.in_room,
    joined: e.joined,
    reminded: e.reminded,
    serverNow: e.server_now,
  }
}
