import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import type { Introducible } from './types'

type Row = {
  id: string
  display_name: string
  username: string
  profile_photos: { storage_path: string; width: number; height: number; position: number }[]
} | null

const PERSON = 'id, display_name, username, profile_photos(storage_path, width, height, position)'

// The caller's matches other than `excludeId` (the chat partner they are introducing): the
// candidates of the picker. RLS hides matches with banned or blocked people.
export async function getIntroducible(viewerId: string, excludeId: string): Promise<Introducible[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('matches')
    .select(`id, a:profiles!matches_user_a_fkey(${PERSON}), b:profiles!matches_user_b_fkey(${PERSON})`)
    .order('created_at', { ascending: false })
  const people = (data ?? [])
    .map((m) => (m.a?.id === viewerId ? m.b : m.a))
    .filter((p): p is NonNullable<Row> => !!p && p.id !== excludeId)
  const first = (p: NonNullable<Row>) =>
    [...p.profile_photos].sort((a, b) => a.position - b.position)[0]
  const urls = await signPhotoPaths(people.flatMap((p) => first(p)?.storage_path ?? []))
  return people.map((p) => {
    const photo = first(p)
    const url = photo && urls.get(photo.storage_path)
    return {
      id: p.id,
      name: p.display_name,
      username: p.username,
      photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
    }
  })
}
