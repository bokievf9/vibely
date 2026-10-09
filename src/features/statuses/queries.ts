import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import { asPlanTag } from '@/features/plans/tags'
import type { Json } from '@/types/database.types'
import type { LiveStatus, OwnStatus, Person, StatusContext, StatusesState } from './types'

// PostgREST: the function does not exist (migration 20261009000271 not applied yet). The app then
// hides the whole feature (no carousel, Plans keep their own picker).
export const MISSING_RPC = 'PGRST202'

export const photoSchema = z
  .object({ path: z.string(), width: z.number(), height: z.number() })
  .nullable()

const ownSchema = z.object({
  id: z.uuid(),
  emoji: z.string(),
  text: z.string(),
  plan_tag: z.string().nullable(),
  moderation_state: z.enum(['visible', 'held', 'removed']),
  created_at: z.string(),
  expires_at: z.string(),
})

export function parseOwnStatus(raw: Json | null | undefined): OwnStatus | null {
  const parsed = ownSchema.safeParse(raw)
  if (!parsed.success || parsed.data.moderation_state === 'removed') return null
  const s = parsed.data
  return {
    id: s.id,
    emoji: s.emoji,
    text: s.text,
    planTag: asPlanTag(s.plan_tag),
    held: s.moderation_state === 'held',
    createdAt: s.created_at,
    expiresAt: s.expires_at,
  }
}

const contextSchema = z.object({
  status_id: z.uuid(),
  author_id: z.uuid(),
  emoji: z.string(),
  text: z.string(),
  plan_tag: z.string().nullable().catch(null),
  expires_at: z.string(),
})

export function parseContext(raw: Json | null | undefined): StatusContext | null {
  const parsed = contextSchema.safeParse(raw)
  if (!parsed.success) return null
  const c = parsed.data
  return {
    statusId: c.status_id,
    authorId: c.author_id,
    emoji: c.emoji,
    text: c.text,
    planTag: asPlanTag(c.plan_tag),
    expiresAt: c.expires_at,
  }
}

const personSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  age: z.number(),
  photo: photoSchema.catch(null).optional(),
})

// A partner shown by name from the start: the RPC includes the profile only when the caller may
// see it; the main photo is signed with the caller's own client (RLS applies).
export async function parsePerson(raw: Json | null | undefined): Promise<Person | null> {
  const parsed = personSchema.safeParse(raw)
  if (!parsed.success) return null
  const p = parsed.data
  let photo = p.photo ?? null
  if (photo === null && p.photo === undefined) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profile_photos')
      .select('storage_path, width, height')
      .eq('profile_id', p.id)
      .order('position')
      .limit(1)
      .maybeSingle()
    photo = data ? { path: data.storage_path, width: data.width, height: data.height } : null
  }
  const url = photo && (await signPhotoPaths([photo.path])).get(photo.path)
  return {
    id: p.id,
    name: p.display_name,
    age: p.age,
    photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
  }
}

// Own status + the carousel, in one place for the Discover and Feed pages (server) and the
// client refresh. `null` when the feature is unavailable or the caller is not verified.
export async function getStatuses(): Promise<StatusesState> {
  const supabase = await createClient()
  const [mine, feed] = await Promise.all([
    supabase.rpc('get_my_status'),
    supabase.rpc('get_live_statuses', { p_limit: 50 }),
  ])
  if (mine.error || feed.error) return null
  const rows = feed.data ?? []
  const photos = new Map(rows.map((r) => [r.id, photoSchema.catch(null).parse(r.photo)]))
  const urls = await signPhotoPaths([...photos.values()].flatMap((p) => (p ? [p.path] : [])))
  const people = rows.map((r): LiveStatus => {
    const photo = photos.get(r.id)
    const url = photo && urls.get(photo.path)
    return {
      id: r.id,
      userId: r.user_id,
      name: r.display_name,
      age: r.age,
      photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
      emoji: r.emoji,
      text: r.text,
      planTag: asPlanTag(r.plan_tag),
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }
  })
  return { own: parseOwnStatus(mine.data), people }
}
