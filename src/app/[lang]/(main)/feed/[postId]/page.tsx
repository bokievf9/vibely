import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PostCardSkeleton } from '@/features/feed/components/post-card'
import { PostThread } from '@/features/feed/components/post-thread'
import { getComments, getPost } from '@/features/feed/queries'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

const isUuid = (id: string) => /^[0-9a-f-]{36}$/.test(id)

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/feed/[postId]'>): Promise<Metadata> {
  const [{ postId }, dict] = await Promise.all([params, getDictionary()])
  const post = isUuid(postId) ? await getPost(postId) : null
  return {
    title: dict.feed.post,
    description: post?.body.slice(0, 160),
    robots: { index: false },
  }
}

export default async function PostPage({ params }: PageProps<'/[lang]/feed/[postId]'>) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <>
      {/* The safe-area inset is added to the 3.5rem bar, not taken out of it (h-14 + pt clipped
          the title under the notch). */}
      <header className="bg-background/90 sticky top-0 z-30 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-1 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link
          href={localePath(locale, '/feed')}
          aria-label={dict.common.back}
          className="active:bg-surface flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="truncate text-xl font-bold">{dict.feed.post}</h1>
      </header>
      <Suspense fallback={<ThreadSkeleton label={dict.common.loading} />}>
        <Thread params={params} />
      </Suspense>
    </>
  )
}

async function Thread({ params }: Pick<PageProps<'/[lang]/feed/[postId]'>, 'params'>) {
  const { postId } = await params
  if (!isUuid(postId)) notFound()
  const [post, comments] = await Promise.all([getPost(postId), getComments(postId)])
  if (!post) notFound()
  return <PostThread post={post} comments={comments} />
}

function ThreadSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6" role="status" aria-label={label}>
      <PostCardSkeleton />
      <Skeleton className="h-3.5 w-28 rounded-full" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[4.5rem] rounded-2xl" />
      ))}
    </div>
  )
}
