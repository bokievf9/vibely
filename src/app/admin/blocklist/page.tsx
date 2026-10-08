import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { BlocklistManager } from '@/features/admin/components/blocklist-manager'
import { getBlocklist } from '@/features/admin/queries/team'

export const metadata: Metadata = { title: 'Блок-лист номеров' }

// Admin and owner (404 for lower roles). Numbers here can't create an account (auth hook).
export default function BlocklistPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Блок-лист номеров</h1>
      <p className="text-muted -mt-2 text-sm">
        С этих номеров нельзя зарегистрироваться заново. Номер забаненного пользователя добавляется
        кнопкой «Заблокировать» на его странице.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <List />
      </Suspense>
    </>
  )
}

async function List() {
  return <BlocklistManager entries={await getBlocklist()} />
}
