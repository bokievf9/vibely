import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getShowLastSeen(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('show_last_seen')
    .eq('id', userId)
    .maybeSingle()
  return data?.show_last_seen ?? true
}
