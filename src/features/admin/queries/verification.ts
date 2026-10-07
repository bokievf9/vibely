import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ageFromBirthDate } from '@/lib/utils'
import { CHALLENGES, isChallengeId } from '@/features/verification/challenges'
import { requireAdmin } from '../guard'
import { signProfilePhotos, signUrls, type SignedPhoto } from './storage'

export type PendingVerification = {
  id: string
  userId: string
  displayName: string
  age: number
  gender: string
  challenge: string
  selfieUrl: string | null
  photos: SignedPhoto[]
  createdAt: string
}

// Oldest first, so nobody waits forever.
export async function getPendingVerifications(limit = 20): Promise<PendingVerification[]> {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('verification_requests')
    .select(
      'id, user_id, selfie_path, challenge, created_at, profiles(display_name, birth_date, gender, profile_photos(storage_path, width, height, position))',
    )
    .eq('status', 'pending')
    .order('created_at')
    .limit(limit)
  if (!data) return []

  const selfies = await signUrls(
    'selfies',
    data.map((r) => r.selfie_path),
  )
  return Promise.all(
    data.map(async (r) => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.profiles?.display_name ?? '—',
      age: r.profiles ? ageFromBirthDate(r.profiles.birth_date) : 0,
      gender: r.profiles?.gender ?? '—',
      challenge: isChallengeId(r.challenge) ? CHALLENGES[r.challenge] : r.challenge,
      selfieUrl: selfies.get(r.selfie_path) ?? null,
      photos: await signProfilePhotos(
        [...(r.profiles?.profile_photos ?? [])].sort((a, b) => a.position - b.position),
      ),
      createdAt: r.created_at,
    })),
  )
}
