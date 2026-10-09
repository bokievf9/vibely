import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { DuoBioCard } from '@/features/admin/components/duo-bio-card'
import { getAdmin } from '@/features/admin/guard'
import { getHeldDuoBios } from '@/features/admin/queries/duo'

export const metadata: Metadata = { title: 'Дуо' }

// Duo Dating: bios held by the automatic check wait here until a moderator approves or rejects
// them. Viewers see the list; decisions are logged (duo_bio.approve / duo_bio.reject).
export default function DuoPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Описания дуо на проверке</h1>
      <p className="text-muted -mt-2 text-sm">
        Подозрительные описания (контакты, ссылки, деньги, ключевые слова) не показываются другим
        дуо, пока модератор их не одобрит. При отклонении описание удаляется.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <HeldBios />
      </Suspense>
    </>
  )
}

async function HeldBios() {
  const [{ role }, { available, bios }] = await Promise.all([getAdmin(), getHeldDuoBios()])
  if (!available) return <p className="text-muted">Раздел недоступен (миграция не применена)</p>
  if (!bios.length) return <p className="text-muted">Нет описаний на проверке</p>
  return (
    <ul className="flex flex-col gap-3">
      {bios.map((b) => (
        <li key={b.teamId}>
          <DuoBioCard bio={b} role={role} />
        </li>
      ))}
    </ul>
  )
}
