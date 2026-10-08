import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { chipClassName } from '@/components/ui/chip'
import { PageSpinner } from '@/components/ui/spinner'
import { AppealCard } from '@/features/admin/components/appeal-card'
import { getAdmin } from '@/features/admin/guard'
import { getAppeals } from '@/features/admin/queries/appeals'

export const metadata: Metadata = { title: 'Апелляции' }

export default function AppealsPage({ searchParams }: PageProps<'/admin/appeals'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Апелляции</h1>
      <Suspense fallback={<PageSpinner />}>
        <Appeals searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Appeals({ searchParams }: Pick<PageProps<'/admin/appeals'>, 'searchParams'>) {
  const decided = (await searchParams).status === 'decided'
  const [{ role }, appeals] = await Promise.all([getAdmin(), getAppeals(decided)])
  return (
    <>
      <nav className="flex gap-2" aria-label="Фильтр">
        <Link href="/admin/appeals" className={chipClassName(!decided)}>
          Открытые
        </Link>
        <Link href="/admin/appeals?status=decided" className={chipClassName(decided)}>
          Решённые
        </Link>
      </nav>
      {!appeals.length ? (
        <p className="text-muted">{decided ? 'Пока нет решённых' : 'Открытых апелляций нет'}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {appeals.map((a) => (
            <li key={a.id}>
              <AppealCard appeal={a} role={role} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
