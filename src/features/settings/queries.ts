import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/features/push/prefs'

export type PrivacySettings = { showLastSeen: boolean; discoverable: boolean }

export async function getPrivacySettings(userId: string): Promise<PrivacySettings> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('show_last_seen, discoverable')
    .eq('id', userId)
    .maybeSingle()
  return { showLastSeen: data?.show_last_seen ?? true, discoverable: data?.discoverable ?? true }
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return DEFAULT_NOTIFICATION_PREFS
  const { new_matches, messages, likes, feed_replies, random_reveal, new_people, calls } = data
  // Column added by 20261009000210: missing until the migration is applied, which means "on".
  const events = 'events' in data ? (data.events ?? true) : true
  // Absent before migration 20261009000250: on.
  const crush = 'crush' in data ? (data.crush ?? true) : true
  return {
    new_matches,
    messages,
    likes,
    feed_replies,
    random_reveal,
    new_people,
    calls,
    events,
    crush,
    // Columns from 20261009000220: absent (undefined) until that migration is applied = on.
    post_replies: data.post_replies ?? true,
    daily_prompt: data.daily_prompt ?? true,
    // Column added by 20261009000240: "on" until that migration is applied.
    matchmaker: data.matchmaker ?? true,
  }
}

// Incognito (20261009000240). `null` when the column does not exist on this database yet: the
// settings row is then hidden. Read apart from getPrivacySettings so a missing column cannot
// break the other privacy switches.
export async function getIncognito(userId: string): Promise<boolean | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('is_incognito')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.is_incognito
}

export type BlockedUser = {
  id: string
  name: string
  photo: { url: string; width: number; height: number } | null
}

const photoSchema = z.object({ path: z.string(), width: z.number(), height: z.number() }).nullable()

// Blocked profiles are invisible to the caller (RLS and storage policies), so the list comes from
// get_blocked_users() (only the caller's own blocks) and its photo paths are signed with the
// service role. The paths were authorized by that RPC, never taken from user input.
export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_blocked_users')
  if (error || !data.length) return []

  const photos = new Map(data.map((b) => [b.id, photoSchema.catch(null).parse(b.photo)]))
  const paths = [...photos.values()].flatMap((p) => (p ? [p.path] : []))
  const urls = new Map<string, string>()
  if (paths.length) {
    try {
      const { data: signed } = await createAdminClient()
        .storage.from('profile-photos')
        .createSignedUrls(paths, 60 * 60)
      signed?.forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl))
    } catch (e) {
      console.error('[settings] could not sign blocked avatars', e)
    }
  }

  return data.map((b) => {
    const photo = photos.get(b.id)
    const url = photo && urls.get(photo.path)
    return {
      id: b.id,
      name: b.display_name,
      photo: photo && url ? { url, width: photo.width, height: photo.height } : null,
    }
  })
}
