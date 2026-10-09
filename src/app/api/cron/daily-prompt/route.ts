import { NO_STORE, rejectUnlessCron } from '@/features/telegram/cron'
import { runDailyPromptPush } from '@/features/prompts/push'

// Question of the day at 19:00 Asia/Kuala_Lumpur (.github/workflows/daily-prompt.yml), same
// Bearer CRON_SECRET as /api/cron/retention. Rotates the question (a no-op after pg_cron) and
// sends the push once. Responds with counts only. Excluded from src/proxy.ts like every cron route.
export async function POST(request: Request) {
  const rejected = rejectUnlessCron(request)
  if (rejected) return rejected
  try {
    const report = await runDailyPromptPush()
    console.info('[daily-prompt]', report)
    return Response.json({ ok: true, ...report }, { headers: NO_STORE })
  } catch (e) {
    console.error('[daily-prompt]', e instanceof Error ? e.message : 'error')
    return Response.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
