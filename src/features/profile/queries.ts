import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/types/database.types'
import { aboutFromRow, promptsFromRows, type AboutInput, type ProfilePrompt } from './about-schemas'

export type Tag = { id: number; slug: string }

export type OwnPhoto = {
  id: string
  path: string
  url: string
  width: number
  height: number
  position: number
}

export type OwnProfile = {
  displayName: string
  birthDate: string
  gender: Enums<'gender'>
  interestedIn: Enums<'gender'>[]
  bio: string
  city: string
  tagIds: number[]
  about: AboutInput
  prompts: ProfilePrompt[]
}

const SIGNED_URL_TTL_S = 60 * 60

export async function getTags(): Promise<Tag[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('tags').select('id, slug').order('slug')
  return data ?? []
}

export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(
      'display_name, birth_date, gender, interested_in, bio, city, profile_tags(tag_id), relationship_goal, height_cm, job_title, education, languages, religion, smoking, drinking, pets, children, profile_prompts(prompt_key, answer, position)',
    )
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    displayName: data.display_name,
    birthDate: data.birth_date,
    gender: data.gender,
    interestedIn: data.interested_in,
    bio: data.bio ?? '',
    city: data.city ?? '',
    tagIds: data.profile_tags.map((t) => t.tag_id),
    about: aboutFromRow(data),
    prompts: promptsFromRows(data.profile_prompts),
  }
}

// Signs storage paths with the caller's own client: RLS lets them read only visible profiles.
export async function signPhotoPaths(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map()
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('profile-photos')
    .createSignedUrls(paths, SIGNED_URL_TTL_S)
  return new Map(
    data?.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])),
  )
}

export async function getOwnPhotos(userId: string): Promise<OwnPhoto[]> {
  const supabase = await createClient()
  const { data: photos } = await supabase
    .from('profile_photos')
    .select('id, storage_path, width, height, position')
    .eq('profile_id', userId)
    .order('position')
  const urls = await signPhotoPaths(photos?.map((p) => p.storage_path) ?? [])
  return (photos ?? []).flatMap((p) => {
    const url = urls.get(p.storage_path)
    return url
      ? [
          {
            id: p.id,
            path: p.storage_path,
            url,
            width: p.width,
            height: p.height,
            position: p.position,
          },
        ]
      : []
  })
}
