import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { PageSpinner } from '@/components/ui/spinner'
import { UserSearch } from '@/features/username/components/user-search'
import { getDictionary } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).username.searchTitle, robots: { index: false } }
}

export default async function SearchPage({ searchParams }: PageProps<'/[lang]/search'>) {
  const dict = await getDictionary()
  return (
    <>
      <PageHeader
        title={dict.username.searchTitle}
        back={{ href: '/swipe', label: dict.common.back }}
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
