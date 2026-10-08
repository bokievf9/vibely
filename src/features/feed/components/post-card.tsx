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
  const body = <p className="text-body wrap-anywhere whitespace-pre-wrap">{post.body}</p>

  return (
    <article className="card flex flex-col gap-3 px-4 pt-4 pb-1">
      <header className="flex items-center justify-between gap-2">
        <AuthorLine
          identity={post.identity}
          fallbackName={dict.feed.author}
          size={40}
          nameClassName="text-[15px] tracking-[-0.01em]"
          meta={
            <time dateTime={post.createdAt}>
              {formatChatTime(post.createdAt, locale)}
              {post.isMine && ` · ${dict.feed.you}`}
            </time>
          }
        />
        <span className="-mr-1.5 shrink-0">
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
      <footer className="-mx-1.5 flex items-center gap-1 border-t border-white/[0.06] pt-1">
        <LikeButton postId={post.id} liked={post.likedByMe} count={post.likes} />
        <LocaleLink
          href={`/feed/${post.id}`}
          className="text-muted active:bg-fill flex h-11 min-w-11 items-center gap-2 rounded-full px-3 text-[15px] font-medium transition-colors"
          aria-label={`${dict.feed.comments}: ${post.comments}`}
        >
          <MessageCircle className="size-[1.375rem] shrink-0" aria-hidden />
          <span className="tabular-nums">{formatCount(post.comments, locale)}</span>
        </LocaleLink>
      </footer>
    </article>
  )
}

// Same box as a post card, so nothing jumps when the real posts arrive.
export function PostCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="bg-fill size-10 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="bg-fill h-3.5 w-28 rounded-full" />
          <Skeleton className="bg-fill h-2.5 w-14 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-2 py-1">
        <Skeleton className="bg-fill h-3.5 w-full rounded-full" />
        <Skeleton className="bg-fill h-3.5 w-11/12 rounded-full" />
        <Skeleton className="bg-fill h-3.5 w-2/3 rounded-full" />
      </div>
      <div className="flex h-9 items-center gap-6">
        <Skeleton className="bg-fill h-5 w-10 rounded-full" />
        <Skeleton className="bg-fill h-5 w-10 rounded-full" />
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
