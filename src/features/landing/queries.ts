import 'server-only'
import { cacheLife } from 'next/cache'
import { z } from 'zod'
import type { Locale } from '@/i18n/config'
import { createAnonClient } from '@/lib/supabase/anon'

// The next Blind Dating Night for the landing page. getCurrentEvent() (src/features/events)
// needs a session (cookies) and returns room counts, so the static landing page reads the
// count-free public variant (get_public_event, 20261009000301) with the anon key instead.
// Cached for minutes: the page stays prerendered and refreshes in the background.

export type LandingEvent = {
  id: string
  title: Record<Locale, string>
  theme: string | null
  startsAt: string
  status: 'scheduled' | 'live'
}

const rowSchema = z.object({
  id: z.uuid(),
  title_en: z.string(),
  title_ms: z.string(),
  title_ru: z.string(),
  theme: z.string().nullable(),
  starts_at: z.string(),
  status: z.enum(['scheduled', 'live']),
})

export async function getLandingEvent(): Promise<LandingEvent | null> {
  'use cache'
  cacheLife('minutes')
  try {
    const { data, error } = await createAnonClient(4000).rpc('get_public_event')
    // Before the migration is applied (PGRST202) or on any error: no block, no noise.
    if (error) return null
    const parsed = rowSchema.safeParse(data?.[0])
    if (!parsed.success) return null
    const e = parsed.data
    return {
      id: e.id,
      title: { en: e.title_en, ms: e.title_ms, ru: e.title_ru },
      theme: e.theme,
      startsAt: e.starts_at,
      status: e.status,
    }
  } catch {
    return null
  }
}
