import { NO_STORE, rejectUnlessCron } from '@/features/telegram/cron'
import { getBot, sendText } from '@/features/telegram/client'
import { sweepSelfies } from '@/features/telegram/selfies'
import { digestText } from '@/features/telegram/stats'

// Daily moderation digest at 09:00 Asia/Kuala_Lumpur (.github/workflows/telegram.yml), same
// Bearer CRON_SECRET as /api/cron/retention. Responds with a flag only.
export async function POST(request: Request) {
  const rejected = rejectUnlessCron(request)
  if (rejected) return rejected
  if (!getBot()) return Response.json({ ok: true, sent: false }, { headers: NO_STORE })
  try {
    await sweepSelfies()
    const text = await digestText()
    const sent = text ? !!(await sendText('general', text)) : false
    return Response.json({ ok: sent, sent }, { status: sent ? 200 : 502, headers: NO_STORE })
  } catch (e) {
    console.error('[telegram-digest]', e instanceof Error ? e.message : 'error')
    return Response.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
