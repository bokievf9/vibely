import { NO_STORE, rejectUnlessCron } from '@/features/telegram/cron'
import { notifyEvent } from '@/features/push/send'
import { createAdminClient } from '@/lib/supabase/admin'

// Every 5 minutes (.github/workflows/events.yml): applies the event clock (a fallback for the
// pg_cron tick), then sends the due Blind Dating Night reminders. event_push_due stamps each row
// before returning it, so a retry never sends twice. Same Bearer CRON_SECRET as the other jobs.
// Responds with counts only.
export async function POST(request: Request) {
  const rejected = rejectUnlessCron(request)
  if (rejected) return rejected
  try {
    const admin = createAdminClient()
    const tick = await admin.rpc('event_tick')
    if (tick.error) throw new Error(`event_tick: ${tick.error.message}`)
    const { data, error } = await admin.rpc('event_push_due')
    if (error) throw new Error(`event_push_due: ${error.message}`)
    let sent = 0
    await Promise.all(
      data.map(async (row) => {
        try {
          await notifyEvent(row.user_id, {
            kind: row.kind === 'start' ? 'start' : 'reminder',
            eventId: row.event_id,
            title: { en: row.title_en, ms: row.title_ms, ru: row.title_ru },
          })
          sent++
        } catch (e) {
          console.error('[events-push] send failed', e instanceof Error ? e.message : e)
        }
      }),
    )
    return Response.json(
      { ok: true, tick: tick.data, due: data.length, sent },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[events-push]', e instanceof Error ? e.message : 'error')
    return Response.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
