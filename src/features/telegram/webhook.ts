import 'server-only'
import { answerCallback, getBot, reply, runAfter } from './client'
import { REFUSAL, runCommand } from './commands'
import { runCallback } from './callbacks'
import { findLinkedAdmin, logRefusal } from './moderation'
import {
  checkAccess,
  decodeCallback,
  isModeratorsChat,
  parseCommand,
  parseUpdate,
  type TgChat,
} from './protocol'
import { sweepSelfies } from './selfies'
import { createThrottle } from './throttle'

// Telegram re-delivers an update when our response is slow or fails: process each id once.
const seenUpdates = new Set<number>()
const rememberUpdate = (id: number) => {
  if (seenUpdates.has(id)) return false
  seenUpdates.add(id)
  if (seenUpdates.size > 2000) {
    const first = seenUpdates.values().next().value
    if (first !== undefined) seenUpdates.delete(first)
  }
  return true
}

// The 46 h selfie cleanup also runs opportunistically on webhook traffic (at most every 10 min),
// in addition to the hourly cron (/api/cron/telegram-sweep).
let lastSweep = 0
function maybeSweep() {
  if (Date.now() - lastSweep < 10 * 60_000) return
  lastSweep = Date.now()
  runAfter('sweep', sweepSelfies)
}

// Refusals (log + reply) at most once a minute per Telegram user, so a stranger spamming the
// bot cannot flood the audit table or make the bot spam back.
const refusals = createThrottle({ limit: 60 })
const firstRefusal = (telegramUserId: number) =>
  refusals.take('refusal', `refuse:${telegramUserId}`, 60_000) !== 'duplicate'

const served = (chat: TgChat | null, moderatorsChat: string) =>
  !!chat && (chat.type === 'private' || isModeratorsChat(chat, moderatorsChat))

export async function handleUpdate(body: unknown): Promise<void> {
  const bot = getBot()
  if (!bot) return
  const update = parseUpdate(body)
  if (update.kind === 'ignored') return
  if (!rememberUpdate(update.updateId)) return
  maybeSweep()

  if (update.kind === 'message') {
    const command = parseCommand(update.text, bot.env.botUsername)
    // Plain chatter and foreign chats are ignored without touching the database.
    if (!command || !served(update.chat, bot.env.chatId)) return
    const admin = await findLinkedAdmin(update.from.id)
    const access = checkAccess({
      chat: update.chat,
      moderatorsChat: bot.env.chatId,
      linked: !!admin,
      command: command.name,
    })
    if (!access.allow) {
      if (!access.reply) return
      if (access.reason !== 'link_in_group') {
        if (!firstRefusal(update.from.id)) return
        await logRefusal(update.from.id, update.chat.id, access.reason, `/${command.name}`)
        await reply(update.chat.id, REFUSAL)
        return
      }
    }
    await runCommand(command.name, {
      chat: update.chat,
      from: update.from,
      messageId: update.messageId,
      admin,
      args: command.args,
    })
    return
  }

  // Button press.
  if (!served(update.chat, bot.env.chatId) || !update.chat || update.messageId === null) {
    await answerCallback(update.callbackId)
    return
  }
  const admin = await findLinkedAdmin(update.from.id)
  const access = checkAccess({
    chat: update.chat,
    moderatorsChat: bot.env.chatId,
    linked: !!admin,
    isCallback: true,
  })
  if (!access.allow || !admin) {
    if (!firstRefusal(update.from.id))
      return answerCallback(update.callbackId, REFUSAL, true).then(() => undefined)
    await logRefusal(
      update.from.id,
      update.chat.id,
      access.allow ? 'not_linked' : access.reason,
      'button',
    )
    await answerCallback(update.callbackId, REFUSAL, true)
    return
  }
  const action = decodeCallback(update.data)
  if (!action) {
    await logRefusal(update.from.id, update.chat.id, 'bad_callback')
    await answerCallback(update.callbackId, 'Кнопка устарела', true)
    return
  }
  await runCallback(action, {
    callbackId: update.callbackId,
    chat: update.chat,
    messageId: update.messageId,
    from: update.from,
    admin,
  })
}
