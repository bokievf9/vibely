import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/features/auth/session'
import { signPhotoPaths } from '@/features/profile/queries'
import { asPlanTag } from '@/features/plans/tags'
import type { Json } from '@/types/database.types'
import type { LiveStatus, OwnStatus, StatusesState } from './types'

const photoSchema = z.object({ path: z.string(), width: z.number(), height: z.number() }).nullable()

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

// Own status + the carousel, in one place for the Discover and Feed pages (server) and the
// client refresh. `null` when the feature is unavailable (the RPCs do not exist until
// 20261009000271 is applied: no carousel, Plans keep their own picker) or the caller is not
// verified.
export async function getStatuses(): Promise<StatusesState> {
  const viewer = await getViewer()
  if (!viewer?.profile || viewer.profile.verificationStatus !== 'approved') return null
  const supabase = await createClient()
  const [mine, feed, ownPhoto] = await Promise.all([
    supabase.rpc('get_my_status'),
    supabase.rpc('get_live_statuses', { p_limit: 50 }),
    supabase
      .from('profile_photos')
      .select('storage_path, width, height')
      .eq('profile_id', viewer.id)
      .order('position')
      .limit(1)
      .maybeSingle(),
  ])
  if (mine.error || feed.error) return null
  const rows = feed.data ?? []
  const photos = new Map(rows.map((r) => [r.id, photoSchema.catch(null).parse(r.photo)]))
  const me = ownPhoto.data
  const urls = await signPhotoPaths([
    ...[...photos.values()].flatMap((p) => (p ? [p.path] : [])),
    ...(me ? [me.storage_path] : []),
  ])
  const meUrl = me && urls.get(me.storage_path)
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
  return {
    own: parseOwnStatus(mine.data),
    people,
    me: {
      name: viewer.profile.displayName,
      photo: me && meUrl ? { url: meUrl, width: me.width, height: me.height } : null,
    },
  }
}
