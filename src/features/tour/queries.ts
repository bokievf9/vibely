import 'server-only'
import { cache } from 'react'
import { getViewer } from '@/features/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { ServerTourState } from './steps'

const AUTO_DAYS = 7
const MISSING = new Set(['PGRST202', '42883', '42P01'])

// The viewer's tour state (my_tour_state, 20261010000200), once per request. Before the migration
// is applied the device keeps its own record: the server then only says whether the account is new
// (profile created in the last 7 days), so older accounts are never interrupted. Any other error
// means no auto-start: the tour must never nag because of a failure.
export const getTourState = cache(async (): Promise<ServerTourState | null> => {
  const viewer = await getViewer()
  if (!viewer?.profile) return null
  const name = viewer.profile.displayName
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_tour_state')
  if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>
    return {
      persisted: true,
      completedAt: typeof d.completed_at === 'string' ? d.completed_at : null,
      skippedAt: typeof d.skipped_at === 'string' ? d.skipped_at : null,
      seenTips: Array.isArray(d.seen_tips)
        ? d.seen_tips.filter((t): t is string => typeof t === 'string')
        : [],
      auto: d.auto === true,
      name,
    }
  }
  const off = { persisted: false, completedAt: null, skippedAt: null, seenTips: [], name }
  if (!error || !MISSING.has(error.code)) return { ...off, auto: false }
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', viewer.id)
    .maybeSingle()
  const joined = profile ? Date.parse(profile.created_at) : NaN
  return { ...off, auto: Date.now() - joined < AUTO_DAYS * 86_400_000 }
})
