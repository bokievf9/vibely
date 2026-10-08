import 'server-only'
import { after } from 'next/server'
import { publicEnv } from '@/lib/env'
import { createTelegramApi, type TelegramApi, type TgFile, type TgResult } from './api'
import { getTelegramEnv, type TelegramEnv } from './env'
import { createThrottle } from './throttle'

export type TgMessage = { message_id: number; chat: { id: number } }
// 'general': the chat itself (no forum topic), e.g. the daily digest.
export type Channel = 'selfies' | 'reports' | 'alerts' | 'general'
export type InlineButton = { text: string; callback_data?: string; url?: string }
export type Keyboard = { inline_keyboard: InlineButton[][] }

// Notifications per minute to the moderators chat (Telegram's group limit is about 20).
const NOTIFICATIONS_PER_MINUTE = 15

let api: TelegramApi | undefined
const throttle = createThrottle({ limit: NOTIFICATIONS_PER_MINUTE })
let summaryTimer: ReturnType<typeof setTimeout> | undefined

export function getBot(): { env: TelegramEnv; api: TelegramApi } | null {
  const env = getTelegramEnv()
  if (!env) return null
  api ??= createTelegramApi({ token: env.token })
  return { env, api }
}

export const adminUrl = (path: string) => new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString()

const KIND_LABELS: Record<string, string> = {
  selfie: 'селфи',
  report: 'жалоб',
  alert: 'оповещений',
}

// One message instead of a flood: sent as soon as the window has room again.
function scheduleSummary() {
  if (summaryTimer) return
  const delay = Math.max(1000, throttle.nextSlotAt() - Date.now() + 500)
  summaryTimer = setTimeout(() => {
    summaryTimer = undefined
    const counts = throttle.drainSummary()
    if (!counts) {
      if (throttle.nextSlotAt() > Date.now()) scheduleSummary()
      return
    }
    const bot = getBot()
    if (!bot) return
    const parts = Object.entries(counts).map(([k, n]) => `${n} ${KIND_LABELS[k] ?? k}`)
    void bot.api.call('sendMessage', {
      chat_id: bot.env.chatId,
      message_thread_id: bot.env.topics.alerts,
      text: `⚠️ Слишком много событий за минуту, не отправлено: ${parts.join(', ')}.\nОчередь: /queue или ${adminUrl('/admin')}`,
      link_preview_options: { is_disabled: true },
    })
  }, delay)
  summaryTimer.unref?.()
}

// Admission for a new notification (`kind`: selfie | report | alert). Returns false when the
// chat is flooded (counted for the summary) or the dedupe key was used recently.
export function admit(kind: 'selfie' | 'report' | 'alert', dedupeKey?: string, ttlMs?: number) {
  const verdict = throttle.take(kind, dedupeKey, ttlMs)
  if (verdict === 'suppressed') scheduleSummary()
  return verdict === 'send'
}

const thread = (env: TelegramEnv, channel: Channel) =>
  channel === 'general' ? undefined : env.topics[channel]

export async function sendText(
  channel: Channel,
  text: string,
  keyboard?: Keyboard,
): Promise<TgMessage | null> {
  const bot = getBot()
  if (!bot) return null
  const res = await bot.api.call<TgMessage>('sendMessage', {
    chat_id: bot.env.chatId,
    message_thread_id: thread(bot.env, channel),
    text: text.slice(0, 4000),
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  })
  return res.ok ? res.result : null
}

export async function sendPhoto(
  channel: Channel,
  file: TgFile,
  caption: string,
): Promise<TgMessage | null> {
  const bot = getBot()
  if (!bot) return null
  const res = await bot.api.upload<TgMessage>(
    'sendPhoto',
    {
      chat_id: bot.env.chatId,
      message_thread_id: thread(bot.env, channel),
      caption: caption.slice(0, 1000),
      // Not forwardable or savable from the chat (biometric data).
      protect_content: true,
    },
    { photo: file },
  )
  return res.ok ? res.result : null
}

export async function sendMediaGroup(channel: Channel, files: TgFile[]): Promise<TgMessage[]> {
  const bot = getBot()
  if (!bot || files.length < 2) return []
  const attach = Object.fromEntries(files.slice(0, 10).map((f, i) => [`p${i}`, f]))
  const res = await bot.api.upload<TgMessage[]>(
    'sendMediaGroup',
    {
      chat_id: bot.env.chatId,
      message_thread_id: thread(bot.env, channel),
      protect_content: true,
      media: Object.keys(attach).map((k) => ({ type: 'photo', media: `attach://${k}` })),
    },
    attach,
  )
  return res.ok ? res.result : []
}

export async function call<T = unknown>(
  method: string,
  params: Record<string, unknown>,
): Promise<TgResult<T>> {
  const bot = getBot()
  if (!bot) return { ok: false, status: 0, description: 'disabled' }
  return bot.api.call<T>(method, params)
}

export async function deleteMessages(chatId: number | string, ids: number[]): Promise<boolean> {
  if (!ids.length) return true
  const res = await call<boolean>('deleteMessages', { chat_id: chatId, message_ids: ids })
  return res.ok
}

export async function editText(
  chatId: number | string,
  messageId: number,
  text: string,
  keyboard?: Keyboard,
) {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4000),
    reply_markup: keyboard ?? { inline_keyboard: [] },
    link_preview_options: { is_disabled: true },
  })
}

export async function editKeyboard(chatId: number | string, messageId: number, keyboard: Keyboard) {
  return call('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard,
  })
}

export async function reply(chatId: number | string, text: string, keyboard?: Keyboard) {
  return call<TgMessage>('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4000),
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  })
}

export async function answerCallback(callbackId: string, text?: string, alert = false) {
  return call('answerCallbackQuery', {
    callback_query_id: callbackId,
    text: text?.slice(0, 190),
    show_alert: alert,
  })
}

// Fire-and-forget after the response; never throws into the caller and never logs secrets.
export function runAfter(label: string, task: () => Promise<unknown>) {
  if (!getTelegramEnv()) return
  const safe = async () => {
    try {
      await task()
    } catch (e) {
      console.error(`[telegram] ${label} failed:`, e instanceof Error ? e.message : 'error')
    }
  }
  try {
    after(safe)
  } catch {
    void safe()
  }
}
