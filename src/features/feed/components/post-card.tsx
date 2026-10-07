'use client'

import { MessageCircle } from 'lucide-react'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { deletePost } from '../actions'
import type { FeedPost } from '../types'
import { ContentMenu } from './content-menu'
import { LikeButton } from './like-button'

type Props = { post: FeedPost; linkToThread?: boolean; onDeleted: () => void }

export function PostCard({ post, linkToThread = true, onDeleted }: Props) {
  const { dict, locale } = useI18n()
  const body = (
    <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.body}</p>
  )

  return (
    <article className="bg-surface flex flex-col gap-3 rounded-3xl p-4">
      <header className="text-muted flex items-center justify-between text-xs">
        <time dateTime={post.createdAt}>
          {formatChatTime(post.createdAt, locale)}
          {post.isMine && ` · ${dict.feed.you}`}
        </time>
        <ContentMenu
          type="post"
          id={post.id}
          isMine={post.isMine}
          onDelete={() => deletePost(post.id)}
          onDeleted={onDeleted}
        />
      </header>
      {linkToThread ? <LocaleLink href={`/feed/${post.id}`}>{body}</LocaleLink> : body}
      <footer className="flex items-center gap-5">
        <LikeButton postId={post.id} liked={post.likedByMe} count={post.likes} />
        <LocaleLink
          href={`/feed/${post.id}`}
          className="text-muted flex items-center gap-1.5 text-sm"
          aria-label={dict.feed.comments}
        >
          <MessageCircle className="size-5" aria-hidden />
          <span className="tabular-nums">{post.comments}</span>
        </LocaleLink>
      </footer>
    </article>
  )
}
