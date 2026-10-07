import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type ModerationStats = {
  pendingVerifications: number
  openReports: number
  bannedUsers: number
  hiddenPosts: number
}

export async function getModerationStats(): Promise<ModerationStats> {
  await requireAdmin()
  const db = createAdminClient()
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0
  const [pendingVerifications, openReports, bannedUsers, hiddenPosts] = await Promise.all([
    count(
      db
        .from('verification_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ),
    count(db.from('reports').select('*', { count: 'exact', head: true }).is('resolved_at', null)),
    count(
      db.from('profiles').select('*', { count: 'exact', head: true }).not('banned_at', 'is', null),
    ),
    count(db.from('posts').select('*', { count: 'exact', head: true }).eq('is_hidden', true)),
  ])
  return { pendingVerifications, openReports, bannedUsers, hiddenPosts }
}
