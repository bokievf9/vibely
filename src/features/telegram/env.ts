import 'server-only'
import { z } from 'zod'

// Optional: without TELEGRAM_BOT_TOKEN and TELEGRAM_MODERATORS_CHAT_ID the bot is off (build and
// app still work). The webhook additionally needs TELEGRAM_WEBHOOK_SECRET.
const topic = z.coerce.number().int().positive().optional()
const telegramEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
  // A group/supergroup id (negative number) or a @channel username.
  TELEGRAM_MODERATORS_CHAT_ID: z.string().regex(/^(-?\d+|@\w{5,})$/),
  // Telegram allows 1-256 characters A-Z a-z 0-9 _ -; we require at least 32.
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,256}$/)
    .optional(),
  // Selfies are uploaded to the moderators chat only when explicitly enabled.
  TELEGRAM_SEND_SELFIES: z.literal('true').optional(),
  // Bot username without "@" (optional): commands addressed to other bots are ignored.
  TELEGRAM_BOT_USERNAME: z
    .string()
    .regex(/^[A-Za-z0-9_]{5,64}$/)
    .optional(),
  // Forum topics (message_thread_id) in the moderators supergroup, all optional.
  TELEGRAM_TOPIC_SELFIES: topic,
  TELEGRAM_TOPIC_REPORTS: topic,
  TELEGRAM_TOPIC_ALERTS: topic,
})

export type TelegramEnv = {
  token: string
  chatId: string
  webhookSecret: string | null
  sendSelfies: boolean
  botUsername: string | undefined
  topics: { selfies?: number; reports?: number; alerts?: number }
}

let cached: TelegramEnv | null | undefined

const val = (name: string) => process.env[name] || undefined

export function getTelegramEnv(): TelegramEnv | null {
  if (cached !== undefined) return cached
  const parsed = telegramEnvSchema.safeParse({
    TELEGRAM_BOT_TOKEN: val('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_MODERATORS_CHAT_ID: val('TELEGRAM_MODERATORS_CHAT_ID'),
    TELEGRAM_WEBHOOK_SECRET: val('TELEGRAM_WEBHOOK_SECRET'),
    TELEGRAM_SEND_SELFIES: val('TELEGRAM_SEND_SELFIES'),
    TELEGRAM_BOT_USERNAME: val('TELEGRAM_BOT_USERNAME')?.replace(/^@/, ''),
    TELEGRAM_TOPIC_SELFIES: val('TELEGRAM_TOPIC_SELFIES'),
    TELEGRAM_TOPIC_REPORTS: val('TELEGRAM_TOPIC_REPORTS'),
    TELEGRAM_TOPIC_ALERTS: val('TELEGRAM_TOPIC_ALERTS'),
  })
  if (!parsed.success) {
    if (val('TELEGRAM_BOT_TOKEN') || val('TELEGRAM_MODERATORS_CHAT_ID')) {
      // Only the names of the invalid variables, never their values.
      const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(', ')
      console.error(`Telegram bot disabled: invalid ${names}`)
    }
    cached = null
    return cached
  }
  const d = parsed.data
  cached = {
    token: d.TELEGRAM_BOT_TOKEN,
    chatId: d.TELEGRAM_MODERATORS_CHAT_ID,
    webhookSecret: d.TELEGRAM_WEBHOOK_SECRET ?? null,
    sendSelfies: d.TELEGRAM_SEND_SELFIES === 'true',
    botUsername: d.TELEGRAM_BOT_USERNAME,
    topics: {
      selfies: d.TELEGRAM_TOPIC_SELFIES,
      reports: d.TELEGRAM_TOPIC_REPORTS,
      alerts: d.TELEGRAM_TOPIC_ALERTS,
    },
  }
  return cached
}
