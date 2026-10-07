import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { ageFromBirthDate } from '@/lib/utils'
import { signPhotoPaths } from './queries'

export type PublicProfile = {
  id: string
  name: string
  age: number
  city: string | null
  bio: string | null
  tags: string[]
  photos: { url: string; width: number; height: number }[]
  matchId: string
}

// Full profile of someone the viewer has matched with (swipes or a mutual randomizer reveal).
export async function getMatchedProfile(
  userId: string,
  viewerId: string,
): Promise<PublicProfile | null> {
  const supabase = await createClient()
  const [a, b] = [userId, viewerId].sort()
  const [{ data: match }, { data: p }] = await Promise.all([
    supabase
      .from('matches')
      .select('id')
      .eq('user_a', a ?? '')
      .eq('user_b', b ?? '')
      .maybeSingle(),
    supabase
      .from('profiles')
      .select(
        'id, display_name, birth_date, city, bio, profile_tags(tags(slug)), profile_photos(storage_path, width, height, position)',
      )
      .eq('id', userId)
      .maybeSingle(),
  ])
  if (!match || !p) return null

  const photos = [...p.profile_photos].sort((x, y) => x.position - y.position)
  const urls = await signPhotoPaths(photos.map((ph) => ph.storage_path))
  return {
    id: p.id,
    name: p.display_name,
    age: ageFromBirthDate(p.birth_date),
    city: p.city,
    bio: p.bio,
    tags: p.profile_tags.flatMap((t) => (t.tags ? [t.tags.slug] : [])),
    photos: photos.flatMap((ph) => {
      const url = urls.get(ph.storage_path)
      return url ? [{ url, width: ph.width, height: ph.height }] : []
    }),
    matchId: match.id,
  }
}
