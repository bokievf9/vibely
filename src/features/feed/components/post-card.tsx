'use client'

import { MessageCircle } from 'lucide-react'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { deletePost } from '../actions'
import type { FeedPost } from '../types'
import { AuthorLine } from './author-line'
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
      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <AuthorLine
            identity={post.identity}
            fallbackName={dict.feed.author}
            nameClassName="text-sm"
          />
          <time dateTime={post.createdAt} className="text-muted text-xs">
            {formatChatTime(post.createdAt, locale)}
            {post.isMine && ` · ${dict.feed.you}`}
          </time>
        </span>
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
