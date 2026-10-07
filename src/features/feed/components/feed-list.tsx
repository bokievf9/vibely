'use client'

import { useState, useTransition } from 'react'
import { ArrowUp, Newspaper } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { createPost, loadFeedPage } from '../actions'
import type { FeedPage } from '../types'
import { Composer } from './composer'
import { PostCard } from './post-card'
import { useNewPosts } from './use-new-posts'

export function FeedList({ initial }: { initial: FeedPage }) {
  const { dict } = useI18n()
  const [page, setPage] = useState(initial)
  const [pending, startTransition] = useTransition()
  const fresh = useNewPosts()

  const reload = () =>
    startTransition(async () => {
      const result = await loadFeedPage(null)
      if (result.ok) setPage(result.data)
      fresh.reset()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })

  const loadMore = () =>
    startTransition(async () => {
      const result = await loadFeedPage(page.nextCursor)
      if (!result.ok) return
      setPage((p) => {
        const seen = new Set(p.posts.map((x) => x.id))
        return {
          posts: [...p.posts, ...result.data.posts.filter((x) => !seen.has(x.id))],
          nextCursor: result.data.nextCursor,
        }
      })
    })

  const remove = (id: string) =>
    setPage((p) => ({ ...p, posts: p.posts.filter((x) => x.id !== id) }))

  return (
    <div className="flex flex-col gap-3 px-4 pb-6">
      <p className="text-muted text-xs">{dict.feed.anonymousNote}</p>
      <Composer
        placeholder={dict.feed.placeholder}
        submitLabel={dict.feed.publish}
        maxLength={1000}
        onSubmit={createPost}
        onDone={reload}
      />
      {fresh.count > 0 && (
        <Button
          size="sm"
          className="sticky top-16 z-20 self-center rounded-full shadow-lg"
          onClick={reload}
        >
          <ArrowUp className="size-4" /> {dict.feed.newPosts} ({fresh.count})
        </Button>
      )}
      {page.posts.length === 0 ? (
        <EmptyState icon={Newspaper} title={dict.feed.empty} text={dict.feed.emptyHint} />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onDeleted={() => remove(post.id)} />
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor && (
        <Button variant="secondary" loading={pending} onClick={loadMore}>
          {dict.feed.loadMore}
        </Button>
      )}
    </div>
  )
}
