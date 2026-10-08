'use client'

import { MessageCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { LocaleLink, useI18n } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { deletePost } from '../actions'
import type { FeedPost } from '../types'
import { AuthorLine } from './author-line'
import { ContentMenu } from './content-menu'
import { formatCount } from './format-count'
import { LikeButton } from './like-button'

type Props = { post: FeedPost; linkToThread?: boolean; onDeleted: () => void }

export function PostCard({ post, linkToThread = true, onDeleted }: Props) {
  const { dict, locale } = useI18n()
  // wrap-anywhere: a pasted link or "hahahaha…" must wrap instead of widening the card.
  const body = (
    <p className="text-[15px] leading-relaxed wrap-anywhere whitespace-pre-wrap">{post.body}</p>
  )

  return (
    <article className="bg-surface flex flex-col gap-3 rounded-3xl p-4">
      <header className="flex items-start justify-between gap-2">
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
        <span className="mt-1.5 mr-0.5">
          <ContentMenu
            type="post"
            id={post.id}
            isMine={post.isMine}
            onDelete={() => deletePost(post.id)}
            onDeleted={onDeleted}
          />
        </span>
      </header>
      {linkToThread ? (
        <LocaleLink href={`/feed/${post.id}`} className="-my-1 rounded-2xl py-1 active:opacity-70">
          {body}
        </LocaleLink>
      ) : (
        body
      )}
      <footer className="-mb-2 flex items-center gap-3">
        <LikeButton postId={post.id} liked={post.likedByMe} count={post.likes} />
        <LocaleLink
          href={`/feed/${post.id}`}
          className="text-muted flex h-11 min-w-11 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors active:bg-white/5"
          aria-label={`${dict.feed.comments}: ${post.comments}`}
        >
          <MessageCircle className="size-5 shrink-0" aria-hidden />
          <span className="tabular-nums">{formatCount(post.comments, locale)}</span>
        </LocaleLink>
      </footer>
    </article>
  )
}

// Same box as a post card, so nothing jumps when the real posts arrive.
export function PostCardSkeleton() {
  return (
    <div className="bg-surface flex flex-col gap-3 rounded-3xl p-4" aria-hidden>
      <div className="flex items-center gap-2">
        <Skeleton className="bg-border/60 size-8 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="bg-border/60 h-3.5 w-28 rounded-full" />
          <Skeleton className="bg-border/60 h-2.5 w-14 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-2 py-1">
        <Skeleton className="bg-border/60 h-3.5 w-full rounded-full" />
        <Skeleton className="bg-border/60 h-3.5 w-11/12 rounded-full" />
        <Skeleton className="bg-border/60 h-3.5 w-2/3 rounded-full" />
      </div>
      <div className="flex h-9 items-center gap-6">
        <Skeleton className="bg-border/60 h-5 w-10 rounded-full" />
        <Skeleton className="bg-border/60 h-5 w-10 rounded-full" />
      </div>
    </div>
  )
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <PostCardSkeleton />
        </li>
      ))}
    </ul>
  )
}
