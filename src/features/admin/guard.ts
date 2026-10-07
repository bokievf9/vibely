import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Returns the moderator's user id, or 404s so the panel's existence isn't revealed.
// Every admin page and action calls this before touching the service-role client.
export const requireAdmin = cache(async (): Promise<string> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) notFound()

  const { data: admin } = await createAdminClient()
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!admin) notFound()
  return userId
})
