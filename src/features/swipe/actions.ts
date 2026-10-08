'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, rateLimitedOr, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { signPhotoPaths } from '@/features/profile/queries'
import { aboutFromRow, parsePrompts } from '@/features/profile/about-schemas'
import { notifyNewLike, notifyNewMatch } from '@/features/push/send'
import { asPlanTag } from '@/features/plans/tags'
import { filtersSchema, swipeSchema, type Candidate, type SwipeFilters } from './schemas'

const storedPhotos = z.array(z.object({ path: z.string(), width: z.number(), height: z.number() }))

export async function loadCandidates(filters: SwipeFilters): Promise<UserResult<Candidate[]>> {
  const parsed = filtersSchema.safeParse(filters)
  if (!parsed.success) return fail('invalidInput')
  const supabase = await createClient()
  const args = {
    p_genders: parsed.data.genders,
    p_min_age: parsed.data.minAge,
    p_max_age: parsed.data.maxAge,
    p_max_km: parsed.data.maxKm,
    p_limit: 20,
  }
  let { data, error } = await supabase.rpc(
    'get_swipe_candidates',
    parsed.data.similarPlans ? { ...args, p_similar_plans: true } : args,
  )
  // PGRST202: the database predates p_similar_plans (migration 20261009000200): plain order.
  if (error?.code === 'PGRST202' && parsed.data.similarPlans) {
    ;({ data, error } = await supabase.rpc('get_swipe_candidates', args))
  }
  if (error || !data) return fail(error?.code === '42501' ? 'unauthorized' : 'generic')

  const photosById = new Map(data.map((c) => [c.id, storedPhotos.catch([]).parse(c.photos)]))
  const urls = await signPhotoPaths([...photosById.values()].flat().map((p) => p.path))

  return ok(
    data.map((c) => ({
      id: c.id,
      name: c.display_name,
      age: c.age,
      bio: c.bio,
      city: c.city,
      distanceKm: c.distance_km,
      tags: c.tags,
      photos: (photosById.get(c.id) ?? []).flatMap((p) => {
        const url = urls.get(p.path)
        return url ? [{ url, width: p.width, height: p.height }] : []
      }),
      about: aboutFromRow(c),
      prompts: parsePrompts(c.prompts),
      secondChance: c.second_chance,
      // Absent before the migration: no badge.
      plan: asPlanTag(c.plan),
    })),
  )
}

export type SwipeResult = { matchId: string | null }

export async function swipe(input: z.input<typeof swipeSchema>): Promise<UserResult<SwipeResult>> {
  const parsed = swipeSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')

  const { targetId, direction } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('swipes').insert({ swiped_id: targetId, direction })
  // 23505: already swiped (double tap, second device). Treat as success.
  if (error && error.code !== '23505') return fail(rateLimitedOr(error.code, 'generic'))

  await supabase.rpc('touch_last_active')
  if (direction === 'pass') return ok({ matchId: null })

  // The DB trigger creates the match on a mutual like; user_a is always the smaller uuid.
  const [a, b] = [viewer.id, targetId].sort()
  const { data: match } = await supabase
    .from('matches')
    .select('id')
    .eq('user_a', a ?? '')
    .eq('user_b', b ?? '')
    .maybeSingle()
  // Only the like that just created the match notifies (not a repeated 23505 insert).
  if (match && !error) notifyNewMatch(targetId, viewer.profile?.displayName ?? '', match.id)
  else if (!error) notifyNewLike(targetId, viewer.id)
  return ok({ matchId: match?.id ?? null })
}
