import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { UserSearch } from '@/features/username/components/user-search'
import { localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).username.searchTitle, robots: { index: false } }
}

export default async function SearchPage({ searchParams }: PageProps<'/[lang]/search'>) {
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
            {dict.username.searchTitle}
          </span>
        }
      />
      <Suspense fallback={<PageSpinner />}>
        <Search searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Search({ searchParams }: Pick<PageProps<'/[lang]/search'>, 'searchParams'>) {
  const { q } = await searchParams
  return <UserSearch initialQuery={typeof q === 'string' ? q.slice(0, 40) : ''} />
}
