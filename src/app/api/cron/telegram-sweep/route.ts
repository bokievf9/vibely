import { NO_STORE, rejectUnlessCron } from '@/features/telegram/cron'
import { getBot } from '@/features/telegram/client'
import { sweepSelfies } from '@/features/telegram/selfies'
import { createAdminClient } from '@/lib/supabase/admin'

// Hourly (.github/workflows/telegram.yml): removes selfie photos from the moderators chat once
// the request is decided or 46 h old (bots may delete only messages younger than 48 h), and
// purges the bot's access audit after 90 days. Same Bearer CRON_SECRET as the retention job.
export async function POST(request: Request) {
  const rejected = rejectUnlessCron(request)
  if (rejected) return rejected
  try {
    const removed = getBot() ? await sweepSelfies() : 0
    const { count } = await createAdminClient()
      .from('telegram_audit')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 3600_000).toISOString())
    return Response.json({ ok: true, removed, auditPurged: count ?? 0 }, { headers: NO_STORE })
  } catch (e) {
    console.error('[telegram-sweep]', e instanceof Error ? e.message : 'error')
    return Response.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
