import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageSpinner } from '@/components/ui/spinner'
import { EventsManager } from '@/features/admin/components/events-manager'
import { getAdmin } from '@/features/admin/guard'
import { getEvents } from '@/features/admin/queries/events'

export const metadata: Metadata = { title: 'Вечера' }

// Blind Dating Nights: everyone on the team sees the list and stats, admins create, edit and
// cancel. Every change is logged in the journal (event.create / event.update / event.cancel).
export default function EventsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Вечера свиданий вслепую</h1>
      <p className="text-muted -mt-2 text-sm">
        Общая комната Blind Dating по расписанию: подбор только по полу и широкому возрасту,
        после «Пропустить» человек сразу возвращается в очередь. Время указывается по Малайзии.
      </p>
      <Suspense fallback={<PageSpinner />}>
        <Events />
      </Suspense>
    </>
  )
}

async function Events() {
  const [{ role }, events] = await Promise.all([getAdmin(), getEvents()])
  return <EventsManager events={events} role={role} />
}
