'use client'

import { fmt } from '@/i18n/config'
import { useI18n, useLocaleRouter } from '@/i18n/client'
import { formatChatTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { createComment, deleteComment } from '../actions'
import type { FeedComment, FeedPost } from '../types'
import { Composer } from './composer'
import { ContentMenu } from './content-menu'
import { PostCard } from './post-card'

export function PostThread({ post, comments }: { post: FeedPost; comments: FeedComment[] }) {
  const { dict, locale } = useI18n()
  const router = useLocaleRouter()

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <PostCard post={post} linkToThread={false} onDeleted={() => router.replace('/feed')} />
      <section aria-labelledby="comments" className="flex flex-col gap-3">
        <h2 id="comments" className="text-muted text-sm font-medium">
          {dict.feed.comments} ({comments.length})
        </h2>
        {comments.length === 0 && <p className="text-muted text-sm">{dict.feed.noComments}</p>}
        <ol className="flex flex-col gap-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn('rounded-2xl px-4 py-3', c.isOp ? 'bg-accent/10' : 'bg-surface')}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className={cn('font-semibold', c.isOp ? 'text-accent' : 'text-foreground')}>
                  {c.isOp ? dict.feed.author : fmt(dict.feed.anonymous, { n: c.aliasNo })}
                  {c.isMine && <span className="text-muted font-normal"> · {dict.feed.you}</span>}
                </span>
                <span className="text-muted flex items-center gap-3">
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
              <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ol>
        <Composer
          placeholder={dict.feed.commentPlaceholder}
          submitLabel={dict.common.send}
          maxLength={500}
          onSubmit={(body) => createComment(post.id, body)}
          onDone={router.refresh}
        />
      </section>
    </div>
  )
}
