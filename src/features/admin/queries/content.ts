import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type ContentItem = {
  type: 'post' | 'comment'
  id: string
  body: string
  hidden: boolean
  authorId: string
  authorName: string
  postId: string
  createdAt: string
}

export type ContentFilter = { type: 'post' | 'comment'; hiddenOnly: boolean; authorId?: string }

// Recent feed content with real authors, for proactive moderation.
export async function getRecentContent({ type, hiddenOnly, authorId }: ContentFilter) {
  await requireAdmin()
  const db = createAdminClient()

  if (type === 'post') {
    let query = db
      .from('posts')
      .select('id, body, is_hidden, author_id, created_at, profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (hiddenOnly) query = query.eq('is_hidden', true)
    if (authorId) query = query.eq('author_id', authorId)
    const { data } = await query
    return (data ?? []).map((p): ContentItem => ({
      type: 'post',
      id: p.id,
      body: p.body,
      hidden: p.is_hidden,
      authorId: p.author_id,
      authorName: p.profiles?.display_name ?? '—',
      postId: p.id,
      createdAt: p.created_at,
    }))
  }

  let query = db
    .from('comments')
    .select('id, body, is_hidden, author_id, post_id, created_at, profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (hiddenOnly) query = query.eq('is_hidden', true)
  if (authorId) query = query.eq('author_id', authorId)
  const { data } = await query
  return (data ?? []).map((c): ContentItem => ({
    type: 'comment',
    id: c.id,
    body: c.body,
    hidden: c.is_hidden,
    authorId: c.author_id,
    authorName: c.profiles?.display_name ?? '—',
    postId: c.post_id,
    createdAt: c.created_at,
  }))
}
