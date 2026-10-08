import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { UsernameSettings } from './schemas'

// The caller's username, cooldown and "Find me by username" flag (my_username() RPC: the
// change date is not readable through the table).
export async function getUsernameSettings(): Promise<UsernameSettings | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_username')
  const row = data?.[0]
  if (!row) return null
  return {
    username: row.username,
    nextChangeAt: row.next_change_at ?? null,
    searchable: row.searchable ?? true,
  }
}
