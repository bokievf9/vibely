import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Views } from '@/types/database.types'
import type { FeedComment, FeedPage, FeedPost } from './types'

export const PAGE_SIZE = 20

// View columns are nullable in generated types; rows from the view always have them.
function toPost(r: Views<'feed_posts'>): FeedPost | null {
  if (!r.id || !r.created_at) return null
  return {
    id: r.id,
    body: r.body ?? '',
    likes: r.likes_count ?? 0,
    comments: r.comments_count ?? 0,
    createdAt: r.created_at,
    isMine: r.is_mine ?? false,
    likedByMe: r.is_liked_by_me ?? false,
  }
}

// Keyset pagination on (created_at, id): stable while new posts keep arriving.
// Cursor format: "<created_at>|<id>".
export async function getFeedPage(cursor: string | null): Promise<FeedPage> {
  const supabase = await createClient()
  let query = supabase
    .from('feed_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)
  if (cursor) {
    const [at, id] = cursor.split('|')
    query = query.or(`created_at.lt."${at}",and(created_at.eq."${at}",id.lt.${id})`)
  }
  const { data } = await query
  const posts = (data ?? []).flatMap((r) => toPost(r) ?? [])
  const last = posts.at(-1)
  return {
    posts,
    nextCursor: posts.length === PAGE_SIZE && last ? `${last.createdAt}|${last.id}` : null,
  }
}

export async function getPost(id: string): Promise<FeedPost | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('feed_posts').select('*').eq('id', id).maybeSingle()
  return data ? toPost(data) : null
}

export async function getComments(postId: string): Promise<FeedComment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at')
    .limit(500)
  return (data ?? []).flatMap((c) =>
    c.id && c.created_at
      ? [
          {
            id: c.id,
            body: c.body ?? '',
            aliasNo: c.alias_no ?? 0,
            isOp: c.is_op ?? false,
            isMine: c.is_mine ?? false,
            createdAt: c.created_at,
          },
        ]
      : [],
  )
}
