'use server'

import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { nightRange } from './event-time'
import { cancelEventSchema, eventFormSchema } from './event-schemas'
import { runAdminAction } from './run-action'

// Blind Dating Nights (/admin/events): admin role for every change, logged by the RPCs as
// event.create / event.update / event.cancel.

export async function saveEvent(input: z.input<typeof eventFormSchema>) {
  return runAdminAction<typeof eventFormSchema, string>(
    eventFormSchema,
    input,
    'admin',
    async (d, admin) => {
      const range = nightRange(d.date, d.startTime, d.endTime)
      if (!range) return { error: { message: 'неверные дата или время' } }
      const { data, error } = await createAdminClient().rpc('admin_upsert_event', {
        p_admin: admin.id,
        p_id: d.id,
        p_title_en: d.titleEn,
        p_title_ms: d.titleMs,
        p_title_ru: d.titleRu,
        p_theme: d.theme || null,
        p_starts_at: range.startsAt,
        p_ends_at: range.endsAt,
        p_recurrence: d.weekly ? 'weekly' : null,
        p_status: d.draft ? 'draft' : 'scheduled',
      })
      return { error, data: data ?? undefined }
    },
  )
}

export async function cancelEvent(input: z.input<typeof cancelEventSchema>) {
  return runAdminAction(cancelEventSchema, input, 'admin', async (d, admin) =>
    createAdminClient().rpc('admin_cancel_event', {
      p_admin: admin.id,
      p_event: d.id,
      p_reason: d.reason,
    }),
  )
}
