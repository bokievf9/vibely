import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageSpinner } from '@/components/ui/spinner'
import { BannedBadge, VerificationBadge, formatDate } from '@/features/admin/components/badges'
import { findUsers } from '@/features/admin/queries/users'
import { maskPhone } from '@/features/admin/mask'

export const metadata: Metadata = { title: 'Пользователи' }

export default function UsersPage({ searchParams }: PageProps<'/admin/users'>) {
  return (
    <>
      <h1 className="text-2xl font-bold">Пользователи</h1>
      <Suspense fallback={<PageSpinner />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Results({ searchParams }: Pick<PageProps<'/admin/users'>, 'searchParams'>) {
  const { q } = await searchParams
  const query = typeof q === 'string' ? q : ''
  const users = await findUsers(query)

  return (
    <>
      <form role="search" className="relative">
        <Search className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <Input
          name="q"
          defaultValue={query}
          placeholder="Имя, @username, телефон или ID"
          aria-label="Поиск"
          className="pl-12"
        />
      </form>
      {!users.length ? (
        <p className="text-muted">Никого не найдено</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className="bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3"
              >
                <span className="font-medium">{u.display_name}</span>
                <span className="text-muted text-sm">@{u.username}</span>
                {/* Masked: the full number is revealed (and logged) on the user page. */}
                <span className="text-muted text-sm">{maskPhone(u.phone)}</span>
                <VerificationBadge status={u.verification_status} />
                {u.banned_at && <BannedBadge />}
                {u.open_reports > 0 && (
                  <span className="text-sm text-amber-400">Жалоб: {u.open_reports}</span>
                )}
                <span className="text-muted ml-auto text-xs">{formatDate(u.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
