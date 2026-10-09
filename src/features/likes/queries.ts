import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import { getVipIds } from '@/features/promo/queries'
import { aboutFromRow, parsePrompts } from '@/features/profile/about-schemas'
import type { Candidate } from '@/features/swipe/schemas'
import { getPlansFor } from '@/features/plans/queries'
import { getIncomingNotes } from '@/features/vip-perks/queries'
import type { IncomingNote } from '@/features/vip-perks/types'

const storedPhotos = z.array(z.object({ path: z.string(), width: z.number(), height: z.number() }))

// People who liked the viewer and are waiting for an answer (badge on Discover).
export async function countIncomingLikes(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('count_incoming_likes')
  return error ? 0 : data
}

// Same card shape as Discover, so the like-back sheet can reuse the swipe card info.
export async function getIncomingLikes(): Promise<Candidate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_incoming_likes', { p_limit: 100 })
  if (error) return []

  const photosById = new Map(data.map((c) => [c.id, storedPhotos.catch([]).parse(c.photos)]))
  const [urls, plans, vips, notes] = await Promise.all([
    signPhotoPaths([...photosById.values()].flat().map((p) => p.path)),
    getPlansFor(data.map((c) => c.id)),
    getVipIds(data.map((c) => c.id)),
    getIncomingNotes(data.map((c) => c.id)),
  ])

  return data.map((c) => ({
    id: c.id,
    name: c.display_name,
    age: c.age,
    bio: c.bio,
    city: c.city,
    distanceKm: c.distance_km,
    secondChance: false,
    vip: vips.has(c.id),
    tags: c.tags,
    photos: (photosById.get(c.id) ?? []).flatMap((p) => {
      const url = urls.get(p.path)
      return url ? [{ url, width: p.width, height: p.height }] : []
    }),
    about: aboutFromRow(c),
    prompts: parsePrompts(c.prompts),
    plan: plans.get(c.id) ?? null,
    note: notes.get(c.id) ?? null,
  }))
}

// Locked "Who liked you" (no list for this viewer): the notes still reach their recipient, with
// the sender's first name only (no photo, no id). Empty before 20261009000290.
export async function getLockedLikeNotes(): Promise<IncomingNote[]> {
  return [...(await getIncomingNotes(null)).values()]
}
