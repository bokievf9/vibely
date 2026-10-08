import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { signUrls } from './storage'

export const PHOTO_PERIODS = [1, 3, 7, 30] as const
export type PhotoPeriod = (typeof PHOTO_PERIODS)[number]

export type RecentPhoto = {
  id: string
  userId: string
  userName: string
  url: string
  width: number
  height: number
  createdAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export const photosSince = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString()

// Photos uploaded recently by verified users, newest first: verified users can swap their
// photos after the selfie check, so new uploads need a second look.
export async function getRecentPhotos(days: PhotoPeriod, limit = 120): Promise<RecentPhoto[]> {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('profile_photos')
    .select(
      'id, profile_id, storage_path, width, height, created_at, profiles!inner(display_name, verification_status)',
    )
    .eq('profiles.verification_status', 'approved')
    .gte('created_at', photosSince(days))
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data?.length) return []

  const urls = await signUrls(
    'profile-photos',
    data.map((p) => p.storage_path),
  )
  return data.flatMap((p) => {
    const url = urls.get(p.storage_path)
    if (!url) return []
    return [
      {
        id: p.id,
        userId: p.profile_id,
        userName: p.profiles.display_name,
        url,
        width: p.width,
        height: p.height,
        createdAt: p.created_at,
      },
    ]
  })
}
