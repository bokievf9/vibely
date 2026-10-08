import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/types/database.types'

export type Viewer = {
  id: string
  profile: {
    displayName: string
    username: string
    verificationStatus: Enums<'verification_status'>
    photoCount: number
    banReason: string | null
  } | null
}

// Data Access Layer entry point: the verified current user, deduped per request.
// Reads cookies, so callers must sit inside a <Suspense> boundary.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const id = claims?.claims.sub
  if (!id) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, username, verification_status, banned_at, ban_reason, profile_photos(count)',
    )
    .eq('id', id)
    .maybeSingle()

  return {
    id,
    profile: profile && {
      displayName: profile.display_name,
      username: profile.username,
      verificationStatus: profile.verification_status,
      photoCount: profile.profile_photos[0]?.count ?? 0,
      banReason: profile.banned_at ? (profile.ban_reason ?? '—') : null,
    },
  }
})

// Where the user should be right now in the sign-up funnel.
export function nextStepFor(viewer: Viewer | null): string {
  if (!viewer) return '/login'
  if (viewer.profile?.banReason) return '/banned'
  if (!viewer.profile || viewer.profile.photoCount === 0) return '/onboarding'
  if (viewer.profile.verificationStatus !== 'approved') return '/selfie-verification'
  return '/swipe'
}

// The phone waiting for its OTP is kept in an HTTP-only cookie, never in the URL.
export const PENDING_PHONE_COOKIE = 'vibely_otp_phone'

export async function getPendingPhone(): Promise<string | null> {
  return (await cookies()).get(PENDING_PHONE_COOKIE)?.value ?? null
}
