import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { photosSince } from './photos'

export type ModerationStats = {
  pendingVerifications: number
  openReports: number
  bannedUsers: number
  hiddenPosts: number
  newPhotos: number
}

export async function getModerationStats(): Promise<ModerationStats> {
  await requireAdmin()
  const db = createAdminClient()
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0
  const [pendingVerifications, openReports, bannedUsers, hiddenPosts, newPhotos] =
    await Promise.all([
      count(
        db
          .from('verification_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ),
      count(db.from('reports').select('*', { count: 'exact', head: true }).is('resolved_at', null)),
      count(
        db
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .not('banned_at', 'is', null),
      ),
      count(db.from('posts').select('*', { count: 'exact', head: true }).eq('is_hidden', true)),
      // Same scope as /admin/photos?days=1: verified users' uploads in the last 24 hours.
      count(
        db
          .from('profile_photos')
          .select('id, profiles!inner(verification_status)', { count: 'exact', head: true })
          .eq('profiles.verification_status', 'approved')
          .gte('created_at', photosSince(1)),
      ),
    ])
  return { pendingVerifications, openReports, bannedUsers, hiddenPosts, newPhotos }
}
