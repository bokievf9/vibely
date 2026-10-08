import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { ageFromBirthDate } from '@/lib/utils'
import { signPhotoPaths } from './queries'
import { getPlansFor } from '@/features/plans/queries'
import type { PlanTag } from '@/features/plans/tags'
import { aboutFromRow, promptsFromRows, type AboutInput, type ProfilePrompt } from './about-schemas'

export type PublicProfile = {
  id: string
  name: string
  username: string
  age: number
  city: string | null
  bio: string | null
  tags: string[]
  photos: { id: string; url: string; width: number; height: number }[]
  about: AboutInput
  prompts: ProfilePrompt[]
  // Null when the viewer opened the profile from search and has not matched with this person.
  matchId: string | null
  // The viewer's earlier swipe on this person (search profiles offer "Like" only when null).
  swiped: 'like' | 'pass' | null
  // Active 24-hour plan, if any.
  plan: PlanTag | null
}

// Full profile of someone the viewer has matched with (swipes or a mutual randomizer reveal),
// or, opened from people search, of a discoverable profile the viewer may see. RLS
// (can_view_profile) already hides banned, unverified and blocked profiles; a paused profile
// (discoverable = false) stays visible to its matches only.
export async function getPublicProfile(
  userId: string,
  viewerId: string,
): Promise<PublicProfile | null> {
  if (userId === viewerId) return null
  const supabase = await createClient()
  const [a, b] = [userId, viewerId].sort()
  const [{ data: match }, { data: p }, { data: swipe }, plans] = await Promise.all([
    supabase
      .from('matches')
      .select('id')
      .eq('user_a', a ?? '')
      .eq('user_b', b ?? '')
      .maybeSingle(),
    supabase
      .from('profiles')
      .select(
        'id, display_name, username, discoverable, birth_date, city, bio, profile_tags(tags(slug)), profile_photos(id, storage_path, width, height, position), relationship_goal, height_cm, job_title, education, languages, religion, smoking, drinking, pets, children, profile_prompts(prompt_key, answer, position)',
      )
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('swipes')
      .select('direction')
      .eq('swiper_id', viewerId)
      .eq('swiped_id', userId)
      .maybeSingle(),
    getPlansFor([userId]),
  ])
  if (!p || (!match && !p.discoverable)) return null

  const photos = [...p.profile_photos].sort((x, y) => x.position - y.position)
  const urls = await signPhotoPaths(photos.map((ph) => ph.storage_path))
  return {
    id: p.id,
    name: p.display_name,
    username: p.username,
    age: ageFromBirthDate(p.birth_date),
    city: p.city,
    bio: p.bio,
    tags: p.profile_tags.flatMap((t) => (t.tags ? [t.tags.slug] : [])),
    photos: photos.flatMap((ph) => {
      const url = urls.get(ph.storage_path)
      return url ? [{ id: ph.id, url, width: ph.width, height: ph.height }] : []
    }),
    about: aboutFromRow(p),
    prompts: promptsFromRows(p.profile_prompts),
    matchId: match?.id ?? null,
    swiped: swipe?.direction ?? null,
    plan: plans.get(userId) ?? null,
  }
}
