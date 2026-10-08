import 'server-only'
import { after } from 'next/server'
import { z } from 'zod'
import { publicEnv } from '@/lib/env'
import type { Enums } from '@/types/database.types'
import { REPORT_REASON_LABELS, TARGET_LABELS } from '@/features/admin/labels'
import type { REPORT_REASONS } from '@/features/safety/schemas'

// Optional: without both variables notifications are silently skipped (build and app still work).
const telegramEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
  // A group/channel id (negative number) or a @channel username.
  TELEGRAM_MODERATORS_CHAT_ID: z.string().regex(/^(-?\d+|@\w{5,})$/),
})

type TelegramEnv = z.infer<typeof telegramEnvSchema>
let cached: TelegramEnv | null | undefined

function getTelegramEnv(): TelegramEnv | null {
  if (cached !== undefined) return cached
  const parsed = telegramEnvSchema.safeParse({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_MODERATORS_CHAT_ID: process.env.TELEGRAM_MODERATORS_CHAT_ID,
  })
  if (
    !parsed.success &&
    (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_MODERATORS_CHAT_ID)
  )
    console.error('Telegram moderator notifications disabled: invalid TELEGRAM_* env')
  cached = parsed.success ? parsed.data : null
  return cached
}

async function send(env: TelegramEnv, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_MODERATORS_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) console.error(`Telegram notification failed: HTTP ${res.status}`)
  } catch (e) {
    console.error('Telegram notification failed:', e instanceof Error ? e.message : e)
  }
}

// Fire-and-forget: runs after the response is sent and never throws into the caller.
function notifyModerators(text: string) {
  const env = getTelegramEnv()
  if (!env) return
  try {
    after(() => send(env, text))
  } catch {
    void send(env, text)
  }
}

const adminUrl = (path: string) => new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString()

export function notifySelfieSubmitted() {
  notifyModerators(`📸 Новое селфи на проверку\n${adminUrl('/admin/verification')}`)
}

// Only the category: never the reporter, their phone or the free-text details.
export function notifyReportCreated(
  targetType: Enums<'report_target'>,
  reason: (typeof REPORT_REASONS)[number],
) {
  notifyModerators(
    `🚩 Новая жалоба: ${TARGET_LABELS[targetType]} — ${REPORT_REASON_LABELS[reason]} (${reason})\n${adminUrl('/admin/reports')}`,
  )
}
