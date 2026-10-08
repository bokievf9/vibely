'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { MAX_PHOTOS } from './schemas'

const photoOrderSchema = z.array(z.uuid()).min(1).max(MAX_PHOTOS)

// The first id becomes the main photo (position 0). The database checks that the list is
// exactly the caller's photos and rewrites all positions in one statement.
export async function reorderPhotos(photoIds: string[]): Promise<UserResult> {
  const parsed = photoOrderSchema.safeParse(photoIds)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_profile_photos', { p_ids: parsed.data })
  return error ? fail('profileSaveFailed') : ok(undefined)
}
