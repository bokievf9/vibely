import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const USER_BUCKETS = ['profile-photos', 'selfies'] as const
const PAGE = 100
// 6 photos + a handful of selfies per user; the cap only guards against an endless loop.
const MAX_PAGES = 20

// Deletes everything under "<user id>/" in every user bucket. Returns false on any error.
export async function removeUserFiles(userId: string): Promise<boolean> {
  const storage = createAdminClient().storage
  for (const bucket of USER_BUCKETS) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await storage.from(bucket).list(userId, { limit: PAGE })
      if (error) return false
      if (!data.length) break
      const { error: removeError } = await storage
        .from(bucket)
        .remove(data.map((file) => `${userId}/${file.name}`))
      if (removeError) return false
      if (data.length < PAGE) break
    }
  }
  return true
}
