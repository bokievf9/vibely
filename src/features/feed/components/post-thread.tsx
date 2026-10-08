'use client'

import { useEffect, useRef } from 'react'
import { MessagesSquare } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { createComment, deleteComment } from '../actions'
import type { FeedComment, FeedPost } from '../types'
import { AuthorLine } from './author-line'
import { Composer } from './composer'
import { ContentMenu } from './content-menu'
import { PostCard } from './post-card'
import { Immersive } from '@/components/layout/immersive'

// A post and its comments. Immersive: the tab bar steps aside and the comment bar is pinned to
// the bottom edge (above the home indicator), like a chat.
export function PostThread({ post, comments }: { post: FeedPost; comments: FeedComment[] }) {
  const { dict, locale } = useI18n()
  const router = useLocaleRouter()

  // After my own comment lands (router.refresh), bring it into view above the bar.
  const count = useRef(comments.length)
  const last = comments.at(-1)
  useEffect(() => {
    const grew = comments.length > count.current
    count.current = comments.length
    if (grew && last?.isMine) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }
  }, [comments.length, last?.isMine])

  return (
    <div data-immersive className="flex flex-1 flex-col">
      <Immersive />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <PostCard post={post} linkToThread={false} onDeleted={() => router.replace('/feed')} />
        <section aria-labelledby="comments" className="flex flex-col gap-3">
          <h2 id="comments" className="text-muted text-sm font-medium">
            {dict.feed.comments} ({comments.length})
          </h2>
          {comments.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessagesSquare className="text-muted size-10" aria-hidden />
              <p className="text-muted text-sm">{dict.feed.noComments}</p>
            </div>
          )}
          <ol className="flex flex-col gap-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className={cn('rounded-2xl px-4 py-3', c.isOp ? 'bg-accent/10' : 'bg-surface')}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <AuthorLine
                    identity={c.identity}
                    fallbackName={fmt(dict.feed.anonymous, { n: c.aliasNo ?? 0 })}
                    size={24}
                    nameClassName={c.isOp ? 'text-accent' : 'text-foreground'}
                  >
                    {c.isOp && (
                      <span className="bg-accent/20 text-accent shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        {dict.feed.author}
                      </span>
                    )}
                    {c.isMine && <span className="text-muted shrink-0"> · {dict.feed.you}</span>}
                  </AuthorLine>
                  <span className="text-muted flex shrink-0 items-center gap-3">
                    <time dateTime={c.createdAt}>{formatChatTime(c.createdAt, locale)}</time>
                    <ContentMenu
                      type="comment"
                      id={c.id}
                      isMine={c.isMine}
                      onDelete={() => deleteComment(c.id)}
                      onDeleted={router.refresh}
                    />
                  </span>
                </div>
                <p className="text-sm wrap-anywhere whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="bg-background/95 border-border sticky bottom-0 z-20 border-t px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Composer
          variant="bar"
          placeholder={dict.feed.commentPlaceholder}
          submitLabel={dict.common.send}
          maxLength={500}
          hint={post.isMine ? dict.feed.opHint : undefined}
          onSubmit={(body, asMe) => createComment(post.id, body, asMe)}
          onDone={router.refresh}
        />
      </div>
    </div>
  )
}
