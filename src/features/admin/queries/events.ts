import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/types/database.types'
import { toMalaysiaParts } from '../event-time'
import { requireAdmin } from '../guard'

export type AdminEvent = {
  id: string
  titleEn: string
  titleMs: string
  titleRu: string
  theme: string | null
  startsAt: string
  endsAt: string
  // Malaysia time, for the edit form.
  date: string
  startTime: string
  endTime: string
  weekly: boolean
  status: Enums<'event_status'>
  parentId: string | null
  stats: { joined: number; pairs: number; matches: number; reminders: number; inRoom: number }
}

// Every night, upcoming and live first, then past ones (viewer and up). Empty until
// 20261009000210 is applied.
export async function getEvents(): Promise<AdminEvent[]> {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_list_events', {
    p_admin: adminId,
    p_limit: 200,
  })
  if (error) {
    if (error.code !== 'PGRST202') console.error('[admin] events', error.message)
    return []
  }
  return data.map((e) => {
    const start = toMalaysiaParts(e.starts_at)
    return {
      id: e.id,
      titleEn: e.title_en,
      titleMs: e.title_ms,
      titleRu: e.title_ru,
      theme: e.theme,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      date: start.date,
      startTime: start.time,
      endTime: toMalaysiaParts(e.ends_at).time,
      weekly: e.recurrence === 'weekly',
      status: e.status,
      parentId: e.parent_id,
      stats: {
        joined: e.joined,
        pairs: e.pairs,
        matches: e.matches,
        reminders: e.reminders,
        inRoom: e.in_room,
      },
    }
  })
}
