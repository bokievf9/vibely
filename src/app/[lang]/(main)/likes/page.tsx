import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Heart } from 'lucide-react'
import { EmptyState } from '@/components/layout/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { LIKES_VISIBLE_FREE } from '@/features/likes/config'
import { LikesGrid } from '@/features/likes/components/likes-grid'
import { countIncomingLikes, getIncomingLikes } from '@/features/likes/queries'
import { fmt, localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).likes.title, robots: { index: false } }
}

export default async function LikesPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Link
              href={localePath(locale, '/swipe')}
              aria-label={dict.common.back}
              className="-ml-2 p-1"
            >
              <ChevronLeft className="size-6" />
            </Link>
            {dict.likes.title}
          </span>
        }
      />
      <Suspense fallback={<PageSpinner />}>
        <Likes />
      </Suspense>
    </>
  )
}

async function Likes() {
  // Without the free flag the list is never loaded: only the count reaches the browser.
  if (LIKES_VISIBLE_FREE) return <LikesGrid initial={await getIncomingLikes()} />
  const [count, dict] = await Promise.all([countIncomingLikes(), getDictionary()])
  return (
    <EmptyState
      icon={Heart}
      title={count > 0 ? fmt(dict.likes.lockedTitle, { count }) : dict.likes.empty}
      text={count > 0 ? dict.likes.lockedHint : dict.likes.emptyHint}
    />
  )
}
