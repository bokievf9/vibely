import 'server-only'
import { signPhotoPaths } from '@/features/profile/queries'
import type { Tables } from '@/types/database.types'
import { toPseudonym } from './pseudonym'
import type { FeedComment, FeedIdentity, FeedPost } from './types'

type IdentityRow = Pick<
  Tables<'feed_posts'>,
  | 'is_named'
  | 'author_id'
  | 'author_name'
  | 'author_age'
  | 'author_verified'
  | 'author_photo_path'
  | 'anon_adj'
  | 'anon_noun'
  | 'anon_color'
>

// Signs every named author's main photo in one call (the viewer's own client: storage RLS
// only lets them read profiles they may see).
export async function signAuthorPhotos(rows: IdentityRow[]): Promise<Map<string, string>> {
  const paths = rows.flatMap((r) =>
    r.is_named && r.author_photo_path ? [r.author_photo_path] : [],
  )
  return signPhotoPaths([...new Set(paths)])
}

function toIdentity(r: IdentityRow, urls: Map<string, string>): FeedIdentity {
  if (r.is_named && r.author_id && r.author_name) {
    return {
      kind: 'named',
      author: {
        id: r.author_id,
        name: r.author_name,
        age: r.author_age,
        verified: r.author_verified ?? false,
        photoUrl: (r.author_photo_path && urls.get(r.author_photo_path)) || null,
      },
    }
  }
  return { kind: 'anonymous', pseudonym: toPseudonym(r.anon_adj, r.anon_noun, r.anon_color) }
}

// View columns are nullable in generated types; rows from the view always have them.
export function toPost(r: Tables<'feed_posts'>, urls: Map<string, string>): FeedPost | null {
  if (!r.id || !r.created_at) return null
  return {
    id: r.id,
    body: r.body ?? '',
    likes: r.likes_count ?? 0,
    comments: r.comments_count ?? 0,
    createdAt: r.created_at,
    isMine: r.is_mine ?? false,
    likedByMe: r.is_liked_by_me ?? false,
    identity: toIdentity(r, urls),
  }
}

export function toComment(
  c: Tables<'post_comments'>,
  urls: Map<string, string>,
): FeedComment | null {
  if (!c.id || !c.created_at) return null
  return {
    id: c.id,
    body: c.body ?? '',
    aliasNo: c.alias_no,
    isOp: c.is_op ?? false,
    isMine: c.is_mine ?? false,
    createdAt: c.created_at,
    identity: toIdentity(c, urls),
  }
}
