import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { FeedList } from '@/features/feed/components/feed-list'
import { getFeedPage } from '@/features/feed/queries'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).feed.title }
}

export default async function FeedPage() {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader title={dict.feed.title} />
      <Suspense fallback={<PageSpinner />}>
        <Feed />
      </Suspense>
    </>
  )
}

async function Feed() {
  return <FeedList initial={await getFeedPage('new', null)} />
}
