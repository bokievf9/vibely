'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { notifySelfieSubmitted } from '@/features/moderation-notify/telegram'
import { CHALLENGE_IDS, isChallengeId, type ChallengeId } from './challenges'

// The server picks the gesture and remembers it, so the client can't choose an easy one.
const CHALLENGE_COOKIE = 'vibely_selfie_challenge'

export async function startVerification(): Promise<UserResult<{ challenge: ChallengeId }>> {
  const viewer = await getViewer()
  if (!viewer?.profile) return fail('profileRequired')

  const [random = 0] = crypto.getRandomValues(new Uint32Array(1))
  const challenge: ChallengeId = CHALLENGE_IDS[random % CHALLENGE_IDS.length] ?? 'peace'
  ;(await cookies()).set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  return ok({ challenge })
}

const submitSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/),
})

export async function submitVerification(input: { path: string }): Promise<UserResult> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return fail('invalidFile')
  const viewer = await getViewer()
  if (!viewer?.profile) return fail('profileRequired')
  if (!parsed.data.path.startsWith(`${viewer.id}/`)) return fail('invalidFile')

  const cookieStore = await cookies()
  const challenge = cookieStore.get(CHALLENGE_COOKIE)?.value
  if (!isChallengeId(challenge)) return fail('challengeExpired')

  const supabase = await createClient()
  const { error } = await supabase
    .from('verification_requests')
    .insert({ selfie_path: parsed.data.path, challenge })
  if (error) return fail(error.code === '23505' ? 'verificationPending' : 'selfieFailed')

  cookieStore.delete(CHALLENGE_COOKIE)
  notifySelfieSubmitted(viewer.id)
  return ok(undefined)
}
