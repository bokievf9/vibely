import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { toCallEntry } from './timeline'
import type { CallEntry, CallSettings } from './types'

const HISTORY_LIMIT = 50
export const CALL_ROW_COLUMNS = 'id, kind, status, caller_id, started_at, answered_at, ended_at'

// Null for non-participants (call_settings returns no row).
export async function getCallSettings(matchId: string): Promise<CallSettings | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('call_settings', { p_match: matchId })
  const row = data?.[0]
  return row
    ? { consented: row.consented, meAllowed: row.me_allowed, partnerAllowed: row.partner_allowed }
    : null
}

// Latest calls of a match for the chat timeline (RLS: only the viewer's own calls).
export async function getCallHistory(matchId: string, viewerId: string): Promise<CallEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('calls')
    .select(CALL_ROW_COLUMNS)
    .eq('match_id', matchId)
    .order('started_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const now = Date.now()
  return (data ?? []).map((row) => toCallEntry(row, viewerId, now)).reverse()
}
