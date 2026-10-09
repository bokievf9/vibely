'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, EyeOff, MapPin, Newspaper, PenLine } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { DailyPromptCard } from '@/features/prompts/components/daily-prompt-card'
import type { DailyPrompt, PromptMatch } from '@/features/prompts/types'
import { createPost, loadFeedPage } from '../actions'
import type { FeedPage, FeedTab } from '../types'
import { Composer } from './composer'
import { FeedTabs } from './feed-tabs'
import { PostCard, PostCardSkeleton, PostListSkeleton } from './post-card'
import { useNewPosts } from './use-new-posts'

const COMPOSER_ID = 'feed-composer'
// Start fetching the next page while the user is still ~1.5 screens away from the end.
const PREFETCH_MARGIN = '0px 0px 1200px 0px'
// Pinned below the sticky page header.
const BELOW_HEADER = 'top-[calc(var(--header-h)+0.5rem)]'

type Props = {
  initial: FeedPage
  // Question of the day (null: none active, not verified, or the migration is not applied).
  prompt?: DailyPrompt | null
  promptMatches?: PromptMatch[]
  // Live statuses carousel (rendered by the page; null when unavailable).
  top?: ReactNode
}

export function FeedList({ initial, prompt = null, promptMatches = [], top }: Props) {
  const { dict } = useI18n()
  const [tab, setTab] = useState<FeedTab>('new')
  const [page, setPage] = useState(initial)
  const [loadedTab, setLoadedTab] = useState<FeedTab>('new')
  // True from a tab tap until its first page arrives: the old tab's posts are never shown under
  // the new tab's pill.
  const [switching, setSwitching] = useState(false)
  const [loadingMore, startLoadingMore] = useTransition()
  const request = useRef(0)
  const sentinel = useRef<HTMLDivElement>(null)
  const fresh = useNewPosts()

  const show = async (next: FeedTab) => {
    const id = ++request.current
    setTab(next)
    setSwitching(true)
    fresh.reset()
    if (window.scrollY > 0) window.scrollTo({ top: 0 })
    const result = await loadFeedPage(next, null)
    // A newer tap won: drop this answer.
    if (id !== request.current) return
    if (result.ok) {
      setPage(result.data)
      setLoadedTab(next)
    } else {
      // Keep the pill on the tab whose posts are on screen.
      setTab(loadedTab)
    }
    setSwitching(false)
  }

  const loadMore = () => {
    if (!page.nextCursor || loadingMore || switching) return
    const id = request.current
    const cursor = page.nextCursor
    startLoadingMore(async () => {
      const result = await loadFeedPage(loadedTab, cursor)
      if (!result.ok || id !== request.current) return
      setPage((p) => {
        const seen = new Set(p.posts.map((x) => x.id))
        return {
          posts: [...p.posts, ...result.data.posts.filter((x) => !seen.has(x.id))],
          nextCursor: result.data.nextCursor,
        }
      })
    })
  }

  // Infinite scroll. The "Show more" button below stays as the fallback (no observer support,
  // a failed page, or a keyboard user).
  const loadMoreRef = useRef(loadMore)
  useEffect(() => {
    loadMoreRef.current = loadMore
  })
  const hasMore = Boolean(page.nextCursor) && !switching
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && loadMoreRef.current(),
      { rootMargin: PREFETCH_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, page.posts.length])

  const remove = (id: string) =>
    setPage((p) => ({ ...p, posts: p.posts.filter((x) => x.id !== id) }))

  const writeFirst = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    document.getElementById(COMPOSER_ID)?.focus({ preventScroll: true })
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-6">
      {top}
      {prompt && <DailyPromptCard prompt={prompt} matches={promptMatches} />}
      <Composer
        id={COMPOSER_ID}
        placeholder={dict.feed.placeholder}
        submitLabel={dict.feed.publish}
        maxLength={1000}
        onSubmit={createPost}
        onDone={() => void show('new')}
      />
      <p className="text-muted text-footnote -mt-0.5 mb-1 flex items-start gap-1.5 px-1">
        <EyeOff className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{dict.feed.anonymousNote}</span>
      </p>
      <FeedTabs tab={tab} onChange={(t) => void show(t)} />
      <AnimatePresence>
        {fresh.count > 0 && (
          <motion.div
            className={`sticky ${BELOW_HEADER} z-20 flex justify-center`}
            initial={{ opacity: 0, transform: 'translateY(-8px) scale(0.96)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transform: 'translateY(-8px) scale(0.96)' }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <Button size="sm" className="h-10 rounded-full px-4" onClick={() => void show('new')}>
              <ArrowUp className="size-4" /> {dict.feed.newPosts} ({fresh.count})
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {switching ? (
        <div role="status" aria-label={dict.common.loading}>
          <PostListSkeleton />
        </div>
      ) : page.posts.length === 0 ? (
        tab === 'city' ? (
          <EmptyState icon={MapPin} title={dict.feed.cityEmpty} text={dict.feed.cityEmptyHint} />
        ) : (
          <EmptyState icon={Newspaper} title={dict.feed.empty} text={dict.feed.emptyHint}>
            <Button variant="secondary" className="mt-2" onClick={writeFirst}>
              <PenLine className="size-5" /> {dict.flows.feed.writeFirst}
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          <ul className="flex flex-col gap-3 pt-1">
            {page.posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} onDeleted={() => remove(post.id)} />
              </li>
            ))}
          </ul>
          <div ref={sentinel} aria-hidden />
          {loadingMore && (
            <div role="status" aria-label={dict.flows.feed.loadingMore}>
              <PostCardSkeleton />
            </div>
          )}
          {page.nextCursor && !loadingMore && (
            <Button variant="secondary" onClick={loadMore}>
              {dict.feed.loadMore}
            </Button>
          )}
          {!page.nextCursor && page.posts.length > 3 && (
            <p className="text-muted py-4 text-center text-sm">{dict.flows.feed.end}</p>
          )}
        </>
      )}
    </div>
  )
}
