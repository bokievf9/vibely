import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
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
      <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link href={localePath(locale, '/feed')} aria-label={dict.common.back} className="p-2">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold">{dict.feed.post}</h1>
      </header>
      <Suspense fallback={<PageSpinner />}>
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
