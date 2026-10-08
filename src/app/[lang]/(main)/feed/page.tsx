import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedList } from '@/features/feed/components/feed-list'
import { PostListSkeleton } from '@/features/feed/components/post-card'
import { feedFixture } from '@/features/feed/components/worst-case'
import { getFeedPage } from '@/features/feed/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).feed.title }
}

export default async function FeedPage({ searchParams }: PageProps<'/[lang]/feed'>) {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.feed.title} />
      <Suspense fallback={<FeedSkeleton label={dict.common.loading} />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Feed({ searchParams }: Pick<PageProps<'/[lang]/feed'>, 'searchParams'>) {
  // Dev-only worst-case data (?data=worst | ?data=empty); always null in production.
  const fixture =
    process.env.NODE_ENV === 'production' ? null : feedFixture(String((await searchParams).data))
  return <FeedList initial={fixture ?? (await getFeedPage('new', null))} />
}

// The shape of FeedList: note, collapsed composer, tabs, cards.
function FeedSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-6" role="status" aria-label={label}>
      <Skeleton className="h-3 w-3/4 rounded-full" />
      <Skeleton className="h-[3.625rem] rounded-3xl" />
      <Skeleton className="h-[3.25rem] rounded-full" />
      <PostListSkeleton />
    </div>
  )
}
