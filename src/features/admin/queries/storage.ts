import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const TTL_S = 60 * 15

// Signed URLs for moderator views (selfies are unreadable to everyone else).
export async function signUrls(
  bucket: 'profile-photos' | 'selfies',
  paths: string[],
): Promise<Map<string, string>> {
  if (!paths.length) return new Map()
  const { data } = await createAdminClient().storage.from(bucket).createSignedUrls(paths, TTL_S)
  return new Map(
    data?.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])),
  )
}

export type SignedPhoto = { url: string; width: number; height: number }

export async function signProfilePhotos(
  photos: { storage_path: string; width: number; height: number }[],
): Promise<SignedPhoto[]> {
  const urls = await signUrls(
    'profile-photos',
    photos.map((p) => p.storage_path),
  )
  return photos.flatMap((p) => {
    const url = urls.get(p.storage_path)
    return url ? [{ url, width: p.width, height: p.height }] : []
  })
}
