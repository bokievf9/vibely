'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { fail, ok, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import {
  editableProfileSchema,
  photoSchema,
  profileSchema,
  type EditableProfileInput,
  type PhotoInput,
  type ProfileInput,
} from './schemas'

function invalid(error: z.ZodError): UserResult<never> {
  return { ok: false, error: zodErrorKey(error), fieldErrors: z.flattenError(error).fieldErrors }
}

const toPoint = (l: { lat: number; lng: number }) => `SRID=4326;POINT(${l.lng} ${l.lat})`

async function replaceTags(tagIds: number[], userId: string) {
  const supabase = await createClient()
  await supabase.from('profile_tags').delete().eq('profile_id', userId)
  if (tagIds.length)
    await supabase.from('profile_tags').insert(tagIds.map((tag_id) => ({ tag_id })))
}

export async function createProfile(input: ProfileInput): Promise<UserResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  if (viewer.profile) return ok(undefined)

  const { displayName, birthDate, gender, interestedIn, bio, city, tagIds, location } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').insert({
    display_name: sanitizeText(displayName),
    birth_date: birthDate,
    gender,
    interested_in: interestedIn,
    bio: sanitizeText(bio) || null,
    city: sanitizeText(city) || null,
    location: location ? toPoint(location) : null,
  })
  if (error) return fail(error.code === '23514' ? 'tooYoung' : 'profileSaveFailed')

  await replaceTags(tagIds, viewer.id)
  return ok(undefined)
}

export async function updateProfile(input: EditableProfileInput): Promise<UserResult> {
  const parsed = editableProfileSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const viewer = await getViewer()
  if (!viewer?.profile) return fail('unauthorized')

  const { displayName, interestedIn, bio, city, tagIds, location } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: sanitizeText(displayName),
      interested_in: interestedIn,
      bio: sanitizeText(bio) || null,
      city: sanitizeText(city) || null,
      // null means "not re-detected": keep the stored location.
      ...(location ? { location: toPoint(location) } : {}),
    })
    .eq('id', viewer.id)
  if (error) return fail('profileSaveFailed')

  await replaceTags(tagIds, viewer.id)
  return ok(undefined)
}

export async function addPhoto(input: PhotoInput): Promise<UserResult> {
  const parsed = photoSchema.safeParse(input)
  if (!parsed.success) return fail('invalidFile')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')
  if (!parsed.data.path.startsWith(`${viewer.id}/`)) return fail('invalidFile')

  const supabase = await createClient()
  const { path, width, height, position } = parsed.data
  const { error } = await supabase
    .from('profile_photos')
    .insert({ storage_path: path, width, height, position })
  return error ? fail('photoUploadFailed') : ok(undefined)
}

export async function deletePhoto(photoId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(photoId)
  if (!id.success) return fail('notFound')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')

  const supabase = await createClient()
  const { data: photo } = await supabase
    .from('profile_photos')
    .delete()
    .eq('id', id.data)
    .eq('profile_id', viewer.id)
    .select('storage_path')
    .maybeSingle()
  if (!photo) return fail('notFound')

  await supabase.storage.from('profile-photos').remove([photo.storage_path])
  return ok(undefined)
}
