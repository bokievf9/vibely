'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { signPhotoPaths } from '@/features/profile/queries'
import type { CrossedPerson } from './types'

const photoSchema = z.object({ path: z.string(), width: z.number(), height: z.number() }).nullable()

// Opted in? `null` when the feature does not exist on this database yet (migration
// 20261009000200 not applied): the app then hides everything about it.
async function readEnabled(): Promise<boolean | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('crossed_paths_settings')
    .select('user_id')
    .maybeSingle()
  return error ? null : Boolean(data)
}

export async function crossedPathsEnabled(): Promise<boolean | null> {
  if (!(await getViewer())) return null
  return readEnabled()
}

export type CrossedPathsState = { enabled: boolean; people: CrossedPerson[] } | null

// Discover strip. Encounters are already delayed (3 h+) and coarse (area name, today/yesterday)
// by get_crossed_paths(); nothing here can reveal a time or an exact place.
export async function loadCrossedPaths(): Promise<CrossedPathsState> {
  if (!(await getViewer())) return null
  const enabled = await readEnabled()
  if (enabled === null) return null
  if (!enabled) return { enabled, people: [] }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_crossed_paths')
  if (error || !data) return null

  const photos = new Map(data.map((p) => [p.id, photoSchema.catch(null).parse(p.photo)]))
  const urls = await signPhotoPaths([...photos.values()].flatMap((p) => (p ? [p.path] : [])))
  const people = data
    .map((p): CrossedPerson => {
      const photo = photos.get(p.id)
      const url = photo && urls.get(photo.path)
      return {
        id: p.id,
        name: p.display_name,
        age: p.age,
        photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
        crossings: p.crossings,
        today: p.is_today,
        area: p.area,
        city: p.city,
      }
    })
    // Today first, then the most crossings.
    .sort((a, b) => Number(b.today) - Number(a.today) || b.crossings - a.crossings)
    .slice(0, 20)
  return { enabled, people }
}

export async function setCrossedPaths(enabled: boolean): Promise<UserResult<boolean>> {
  const value = z.boolean().safeParse(enabled)
  if (!value.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_crossed_paths', { p_enabled: value.data })
  if (error) return fail(error.code === '42501' ? 'unauthorized' : 'generic')
  return ok(value.data)
}

export async function hideCrossedPath(userId: string): Promise<UserResult> {
  const id = z.uuid().safeParse(userId)
  if (!id.success) return fail('invalidInput')
  if (!(await getViewer())) return fail('unauthorized')
  const supabase = await createClient()
  const { error } = await supabase.rpc('hide_crossed_path', { p_user: id.data })
  return error ? fail('generic') : ok(undefined)
}

const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// Foreground ping. The database turns it into a ~1 km cell + day at once and stores nothing
// unless the caller opted in (and at most one ping per ~10 minutes). Coordinates are not logged.
export async function pingLocation(lat: number, lng: number): Promise<boolean> {
  const parsed = pingSchema.safeParse({ lat, lng })
  if (!parsed.success) return false
  if (!(await getViewer())) return false
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('ping_location', {
    p_lat: parsed.data.lat,
    p_lng: parsed.data.lng,
  })
  return !error && Boolean(data)
}
