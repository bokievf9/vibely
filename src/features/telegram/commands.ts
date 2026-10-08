import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { BAN_LABELS, readableBan } from '@/features/admin/labels'
import { BAN_CODES, type BanCode } from '@/features/safety/reason-codes'
import { adminUrl, call, reply } from './client'
import { userBanConfirmKeyboard, userUnbanConfirmKeyboard } from './keyboards'
import { logModeration, logRefusal, type LinkedAdmin } from './moderation'
import {
  linkCodeHash,
  maskPhone,
  parseUserQuery,
  plain,
  type CommandName,
  type TgChat,
  type TgUser,
} from './protocol'
import { queueText, statsText } from './stats'

type Ctx = {
  chat: TgChat
  from: TgUser
  messageId: number
  admin: LinkedAdmin | null
  args: string[]
}

export const BOT_COMMANDS: { command: CommandName; description: string }[] = [
  { command: 'stats', description: 'Очереди и статистика за сегодня' },
  { command: 'queue', description: 'Самые старые селфи и жалобы' },
  { command: 'user', description: 'Пользователь: /user @username, телефон или id' },
  { command: 'ban', description: 'Бан: /ban @username причина' },
  { command: 'unban', description: 'Разбан: /unban @username' },
  { command: 'link', description: 'Привязать аккаунт модератора: /link КОД' },
  { command: 'help', description: 'Справка' },
]

const HELP_LINKED = [
  'Бот модерации Vibely.',
  '/stats: очереди и счётчики за сегодня',
  '/queue: самые старые селфи и жалобы',
  '/user @username | телефон | id: сводка по пользователю',
  `/ban @username причина: бан с подтверждением (причины: ${BAN_CODES.join(', ')})`,
  '/unban @username: разбан с подтверждением',
  'Кнопки под селфи и жалобами работают только для привязанных модераторов.',
].join('\n')

const HELP_UNLINKED = [
  'Это служебный бот модерации Vibely.',
  `Если вы модератор: откройте ${adminUrl('/admin/telegram')}, получите код и отправьте сюда /link КОД.`,
].join('\n')

export const REFUSAL =
  'Извините, этот бот доступен только модераторам Vibely. Если вы модератор, привяжите аккаунт в панели модерации.'

async function lookupUsers(admin: LinkedAdmin, raw: string | undefined) {
  const q = parseUserQuery(raw)
  if (!q) return null
  const { data } = await createAdminClient().rpc('admin_find_users', {
    p_admin: admin.adminId,
    p_query: q.kind === 'username' ? `@${q.value}` : q.value,
    p_limit: 20,
  })
  const rows = (data ?? []).filter((r) =>
    q.kind === 'id'
      ? r.id === q.value
      : q.kind === 'username'
        ? r.username === q.value
        : (r.phone ?? '').replace(/\D/g, '').endsWith(q.value.replace(/^0+/, '')),
  )
  return rows.slice(0, 3)
}

const VERIFICATION: Record<string, string> = {
  approved: 'верифицирован',
  pending: 'селфи на проверке',
  rejected: 'селфи отклонено',
  unverified: 'не верифицирован',
}

async function userSummary(ctx: Ctx & { admin: LinkedAdmin }) {
  const rows = await lookupUsers(ctx.admin, ctx.args.join(' '))
  if (rows === null)
    return reply(ctx.chat.id, 'Формат: /user @username, /user +60123456789 или /user <id>')
  if (!rows.length) return reply(ctx.chat.id, 'Никого не нашлось.')
  const db = createAdminClient()
  const parts: string[] = []
  for (const r of rows) {
    const { data: p } = await db.from('profiles').select('ban_reason').eq('id', r.id).maybeSingle()
    // Every lookup is logged against the account it revealed.
    await logModeration(ctx.admin.adminId, 'user.lookup', 'user', r.id, 'telegram /user')
    parts.push(
      [
        `👤 ${plain(r.display_name)} (@${r.username})`,
        `Телефон: ${maskPhone(r.phone)}`,
        `Верификация: ${VERIFICATION[r.verification_status] ?? r.verification_status}`,
        r.banned_at
          ? `Бан: да, ${p?.ban_reason ? readableBan(p.ban_reason).slice(0, 80) : 'без причины'}`
          : 'Бан: нет',
        `Открытых жалоб на профиль: ${r.open_reports}`,
        adminUrl(`/admin/users/${r.id}`),
      ].join('\n'),
    )
  }
  return reply(ctx.chat.id, parts.join('\n\n'))
}

async function userByUsername(raw: string | undefined) {
  const q = parseUserQuery(raw)
  if (q?.kind !== 'username') return null
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, display_name, username, banned_at')
    .eq('username', q.value)
    .maybeSingle()
  return data
}

async function banCommand(ctx: Ctx & { admin: LinkedAdmin }) {
  const [handle, code] = ctx.args
  if (!code || !BAN_CODES.includes(code as BanCode)) {
    return reply(ctx.chat.id, `Формат: /ban @username причина\nПричины: ${BAN_CODES.join(', ')}`)
  }
  const user = await userByUsername(handle)
  if (!user) return reply(ctx.chat.id, 'Пользователь не найден (нужен точный @username).')
  if (user.banned_at) return reply(ctx.chat.id, `@${user.username} уже заблокирован.`)
  return reply(
    ctx.chat.id,
    `Заблокировать ${plain(user.display_name)} (@${user.username})?\nПричина: ${BAN_LABELS[code as BanCode]}`,
    userBanConfirmKeyboard(user.id, code),
  )
}

async function unbanCommand(ctx: Ctx & { admin: LinkedAdmin }) {
  const user = await userByUsername(ctx.args[0])
  if (!user) return reply(ctx.chat.id, 'Формат: /unban @username (точный @username).')
  if (!user.banned_at) return reply(ctx.chat.id, `@${user.username} не заблокирован.`)
  return reply(
    ctx.chat.id,
    `Разблокировать ${plain(user.display_name)} (@${user.username})?`,
    userUnbanConfirmKeyboard(user.id),
  )
}

async function linkCommand(ctx: Ctx) {
  const code = ctx.args.join('')
  if (ctx.chat.type !== 'private') {
    // A code posted in a group is burned at once and the message removed (if the bot may).
    if (code) {
      await createAdminClient()
        .from('telegram_link_codes')
        .delete()
        .eq('code_hash', linkCodeHash(code))
      await call('deleteMessage', { chat_id: ctx.chat.id, message_id: ctx.messageId })
    }
    await logRefusal(ctx.from.id, ctx.chat.id, 'link_in_group')
    return reply(
      ctx.chat.id,
      'Код нельзя отправлять в группу: он аннулирован. Получите новый в панели и отправьте /link КОД боту в личные сообщения.',
    )
  }
  if (!code)
    return reply(ctx.chat.id, 'Формат: /link КОД (код из панели модерации, действует 10 минут).')
  const { data, error } = await createAdminClient()
    .rpc('telegram_link_admin', { p_code: code.slice(0, 32), p_telegram_user_id: ctx.from.id })
    .maybeSingle()
  if (error || !data) {
    console.error('[telegram] link failed:', error?.code)
    return reply(ctx.chat.id, 'Не получилось, попробуйте позже.')
  }
  switch (data.result) {
    case 'linked':
      return reply(ctx.chat.id, `Готово, аккаунт привязан.\n\n${HELP_LINKED}`)
    case 'taken':
      return reply(
        ctx.chat.id,
        'Этот Telegram уже привязан к другому модератору. Сначала отвяжите его в панели.',
      )
    case 'throttled':
      return reply(ctx.chat.id, 'Слишком много попыток. Подождите 15 минут.')
    default:
      return reply(ctx.chat.id, 'Код неверный или истёк. Получите новый в панели модерации.')
  }
}

export async function runCommand(name: CommandName, ctx: Ctx) {
  if (name === 'link') return linkCommand(ctx)
  if (name === 'start' || name === 'help') {
    return reply(ctx.chat.id, ctx.admin ? HELP_LINKED : HELP_UNLINKED)
  }
  // checkAccess() guarantees a linked moderator for everything below.
  const admin = ctx.admin
  if (!admin) return reply(ctx.chat.id, REFUSAL)
  const c = { ...ctx, admin }
  switch (name) {
    case 'stats':
      return reply(ctx.chat.id, await statsText())
    case 'queue':
      return reply(ctx.chat.id, await queueText())
    case 'user':
      return userSummary(c)
    case 'ban':
      return banCommand(c)
    case 'unban':
      return unbanCommand(c)
  }
}
