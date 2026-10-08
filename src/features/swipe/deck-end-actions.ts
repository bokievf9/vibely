'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getRandomStats } from '@/features/randomizer/actions'
import { AGE_MAX, AGE_MIN, DISTANCE_MAX_KM, filtersSchema, type SwipeFilters } from './schemas'

const KM_STEP = 25
const AGE_STEP = 5

export type WidenOption = { filters: SwipeFilters; extra: number }

export type DeckEndInfo = {
  widerKm: WidenOption | null
  widerAge: WidenOption | null
  searching: number
  // Minutes since the newest visible feed post (formatted on the client).
  newestPostMinutes: number | null
  alertOn: boolean
  invite: { code: string; invited: number } | null
}

function widenings(f: SwipeFilters) {
  const km = Math.min(DISTANCE_MAX_KM, f.maxKm + KM_STEP)
  const minAge = Math.max(AGE_MIN, f.minAge - AGE_STEP)
  const maxAge = Math.min(AGE_MAX, f.maxAge + AGE_STEP)
  return {
    km: km > f.maxKm ? { ...f, maxKm: km } : null,
    age: minAge < f.minAge || maxAge > f.maxAge ? { ...f, minAge, maxAge } : null,
  }
}

// Everything the "you've seen everyone nearby" screen shows, in one round trip.
export async function loadDeckEnd(filters: SwipeFilters): Promise<UserResult<DeckEndInfo>> {
  const parsed = filtersSchema.safeParse(filters)
  if (!parsed.success) return fail('invalidInput')
  const supabase = await createClient()
  const count = async (f: SwipeFilters | null) => {
    if (!f) return null
    const { data, error } = await supabase.rpc('count_swipe_candidates', {
      p_genders: f.genders,
      p_min_age: f.minAge,
      p_max_age: f.maxAge,
      p_max_km: f.maxKm,
    })
    return error ? null : data
  }
  const wide = widenings(parsed.data)

  const [current, km, age, searching, post, alert, invite] = await Promise.all([
    count(parsed.data),
    count(wide.km),
    count(wide.age),
    getRandomStats(),
    supabase
      .from('feed_posts')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('new_people_alerts').select('user_id').maybeSingle(),
    supabase.rpc('get_my_referral').maybeSingle(),
  ])
  if (current === null) return fail('unauthorized')

  const option = (f: SwipeFilters | null, n: number | null): WidenOption | null =>
    f && n !== null && n > current ? { filters: f, extra: n - current } : null
  return ok({
    widerKm: option(wide.km, km),
    widerAge: option(wide.age, age),
    searching,
    newestPostMinutes: post.data?.created_at
      ? Math.max(0, Math.round((Date.now() - Date.parse(post.data.created_at)) / 60_000))
      : null,
    alertOn: Boolean(alert.data),
    invite: invite.data ?? null,
  })
}

const alertSchema = z.object({ enabled: z.boolean(), filters: filtersSchema })

// Opt in/out of "new people" pushes; the current filters are saved for matching on the server.
export async function setNewPeopleAlert(
  input: z.input<typeof alertSchema>,
): Promise<UserResult<boolean>> {
  const parsed = alertSchema.safeParse(input)
  if (!parsed.success) return fail('invalidInput')
  const { enabled, filters: f } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_new_people_alert', {
    p_enabled: enabled,
    p_genders: f.genders,
    p_min_age: f.minAge,
    p_max_age: f.maxAge,
    p_max_km: f.maxKm,
  })
  if (error) return fail(error.code === '42501' ? 'unauthorized' : 'generic')
  return ok(data)
}
