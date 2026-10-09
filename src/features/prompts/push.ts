import 'server-only'
import { z } from 'zod'
import { sendToUser } from '@/features/push/send'
import { fmt, localePath } from '@/i18n/config'
import { getPushEnv } from '@/lib/env.server'
import { createAdminClient } from '@/lib/supabase/admin'

export type DailyPromptReport = {
  // False until the migration is applied, or when the queue is empty.
  active: boolean
  promptId: string | null
  recipients: number
  sent: number
}

const SEND_CONCURRENCY = 8
// PostgREST: the function does not exist (migration 20261009000220 not applied yet).
const MISSING_RPC = 'PGRST202'

// The 19:00 Asia/Kuala_Lumpur job (.github/workflows/daily-prompt.yml): activates today's
// question (idempotent, pg_cron usually did it already) and pushes it once to everyone verified
// and active who kept "Question of the day" on. daily_prompt_push_recipients claims the prompt's
// pushed_at, so a retry sends to nobody. The push carries the question in the device's language
// and opens the feed; no personal data.
export async function runDailyPromptPush(): Promise<DailyPromptReport> {
  const admin = createAdminClient()
  const { data: promptId, error } = await admin.rpc('rotate_daily_prompt')
  if (error) {
    if (error.code === MISSING_RPC) return { active: false, promptId: null, recipients: 0, sent: 0 }
    throw new Error(`rotate_daily_prompt: ${error.message}`)
  }
  if (!promptId) return { active: false, promptId: null, recipients: 0, sent: 0 }

  const { data: prompt, error: promptError } = await admin
    .from('daily_prompts')
    .select('question_en, question_ms, question_ru')
    .eq('id', promptId)
    .single()
  if (promptError) throw new Error(`daily prompt: ${promptError.message}`)
  const question = { en: prompt.question_en, ms: prompt.question_ms, ru: prompt.question_ru }

  if (!getPushEnv()) return { active: true, promptId, recipients: 0, sent: 0 }
  const { data: rows, error: recipientsError } = await admin.rpc('daily_prompt_push_recipients', {
    p_prompt: promptId,
  })
  if (recipientsError) throw new Error(`daily_prompt_push_recipients: ${recipientsError.message}`)
  const recipients = z.array(z.uuid()).catch([]).parse(rows)

  let sent = 0
  let next = 0
  const worker = async () => {
    while (next < recipients.length) {
      const userId = recipients[next++]
      if (!userId) continue
      try {
        await sendToUser(
          userId,
          'daily_prompt',
          (dict, locale) => ({
            title: fmt(dict.conversations.promptPush, { question: question[locale] }),
            body: dict.conversations.promptPushBody,
            url: localePath(locale, '/feed'),
            tag: 'daily-prompt',
          }),
          // Stale by the time the next question arrives.
          { ttl: 20 * 60 * 60 },
        )
        sent += 1
      } catch (e) {
        console.error('[push] daily prompt', e instanceof Error ? e.message : e)
      }
    }
  }
  await Promise.all(Array.from({ length: SEND_CONCURRENCY }, worker))
  return { active: true, promptId, recipients: recipients.length, sent }
}
