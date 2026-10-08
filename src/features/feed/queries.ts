import 'server-only'
import { signPhotoPaths } from '@/features/profile/queries'
import { createClient } from '@/lib/supabase/server'
import { ageFromBirthDate } from '@/lib/utils'
import { signAuthorPhotos, toComment, toPost } from './rows'
import type { AuthorCard, FeedComment, FeedPage, FeedPost, FeedTab } from './types'

export const PAGE_SIZE = 20
const TOP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// New / My city: keyset pagination on (created_at, id), stable while new posts keep arriving;
// cursor "<created_at>|<id>". Top: ranked by likes + comments of the last 7 days; cursor "o:<offset>".
export async function getFeedPage(tab: FeedTab, cursor: string | null): Promise<FeedPage> {
  const supabase = await createClient()
  let query = supabase.from('feed_posts').select('*')
  const offset = cursor?.startsWith('o:') ? Number(cursor.slice(2)) : 0

  if (tab === 'top') {
    const since = new Date(Date.now() - TOP_WINDOW_MS).toISOString()
    query = query
      .gt('created_at', since)
      .order('engagement', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
  } else {
    if (tab === 'city') query = query.eq('same_city', true)
    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
    if (cursor && !cursor.startsWith('o:')) {
      const [at, id] = cursor.split('|')
      query = query.or(`created_at.lt."${at}",and(created_at.eq."${at}",id.lt.${id})`)
    }
  }

  const { data } = await query
  const rows = data ?? []
  const urls = await signAuthorPhotos(rows)
  const posts = rows.flatMap((r) => toPost(r, urls) ?? [])
  const last = posts.at(-1)
  const full = rows.length === PAGE_SIZE
  const nextCursor =
    !full || !last
      ? null
      : tab === 'top'
        ? `o:${offset + PAGE_SIZE}`
        : `${last.createdAt}|${last.id}`
  return { posts, nextCursor }
}

export async function getPost(id: string): Promise<FeedPost | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('feed_posts').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  return toPost(data, await signAuthorPhotos([data]))
}

export async function getComments(postId: string): Promise<FeedComment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at')
    .limit(500)
  const rows = data ?? []
  const urls = await signAuthorPhotos(rows)
  return rows.flatMap((c) => toComment(c, urls) ?? [])
}

// Read-only card of a named author. RLS returns nothing for hidden, banned or blocked profiles.
export async function getAuthorCard(userId: string): Promise<AuthorCard | null> {
  const supabase = await createClient()
  const { data: p } = await supabase
    .from('profiles')
    .select(
      'id, display_name, username, birth_date, bio, verification_status, profile_photos(storage_path, width, height, position)',
    )
    .eq('id', userId)
    .maybeSingle()
  if (!p) return null
  const photos = [...p.profile_photos].sort((x, y) => x.position - y.position)
  const urls = await signPhotoPaths(photos.map((ph) => ph.storage_path))
  return {
    id: p.id,
    name: p.display_name,
    username: p.username,
    age: ageFromBirthDate(p.birth_date),
    verified: p.verification_status === 'approved',
    bio: p.bio ?? '',
    photos: photos.flatMap((ph) => {
      const url = urls.get(ph.storage_path)
      return url ? [{ url, width: ph.width, height: ph.height }] : []
    }),
  }
}
