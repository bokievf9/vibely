import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { chipClassName } from '@/components/ui/chip'
import { PageSpinner } from '@/components/ui/spinner'
import { ContentRow } from '@/features/admin/components/content-row'
import { getRecentContent } from '@/features/admin/queries/content'

export const metadata: Metadata = { title: 'Контент' }

export default function ContentPage({ searchParams }: PageProps<'/admin/content'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Анонимная лента</h1>
      <Suspense fallback={<PageSpinner />}>
        <ContentList searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function ContentList({ searchParams }: Pick<PageProps<'/admin/content'>, 'searchParams'>) {
  const sp = await searchParams
  const type = sp.type === 'comment' ? 'comment' : 'post'
  const hiddenOnly = sp.hidden === '1'
  const authorId =
    typeof sp.author === 'string' && /^[0-9a-f-]{36}$/.test(sp.author) ? sp.author : undefined
  const items = await getRecentContent({ type, hiddenOnly, authorId })

  const href = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { type, hidden: hiddenOnly ? '1' : undefined, author: authorId, ...next }
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v))
    return `/admin/content?${params}`
  }

  return (
    <>
      <nav aria-label="Фильтры" className="flex flex-wrap gap-2">
        <Link href={href({ type: 'post' })} className={chipClassName(type === 'post')}>
          Посты
        </Link>
        <Link href={href({ type: 'comment' })} className={chipClassName(type === 'comment')}>
          Комментарии
        </Link>
        <Link
          href={href({ hidden: hiddenOnly ? undefined : '1' })}
          className={chipClassName(hiddenOnly)}
        >
          Только скрытые
        </Link>
        {authorId && (
          <Link href={href({ author: undefined })} className={chipClassName(true)}>
            Один автор ✕
          </Link>
        )}
      </nav>
      {!items.length ? (
        <p className="text-muted">Ничего нет</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <ContentRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
