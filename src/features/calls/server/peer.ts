import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import type { CallPeer } from '../types'

// The other side of a call as the viewer may see it (RLS: verified, visible, not blocked).
export async function loadPeer(userId: string | null): Promise<CallPeer | null> {
  if (!userId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, profile_photos(storage_path, position)')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  const first = [...data.profile_photos].sort((a, b) => a.position - b.position)[0]
  const urls = await signPhotoPaths(first ? [first.storage_path] : [])
  return {
    id: data.id,
    name: data.display_name,
    photoUrl: (first && urls.get(first.storage_path)) ?? null,
  }
}
