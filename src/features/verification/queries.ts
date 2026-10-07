import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getLatestRejection(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('verification_requests')
    .select('status, rejection_reason')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.status !== 'rejected') return null
  return data.rejection_reason ?? '—'
}
