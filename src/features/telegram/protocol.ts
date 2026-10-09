// Pure helpers of the Telegram moderation bot: webhook secret check, update parsing, command
// parsing, callback data encoding and the access rules. No imports with side effects, so the
// unit tests (tests/unit/telegram.test.mjs) load this file directly.
import { createHash, timingSafeEqual } from 'node:crypto'

// ---------- webhook secret ----------

// Constant-time comparison of the X-Telegram-Bot-Api-Secret-Token header (hashing first makes
// the lengths equal, so the length is not leaked either).
export function isValidSecret(received: string | null | undefined, expected: string): boolean {
  if (!expected || typeof received !== 'string' || received.length === 0) return false
  const a = createHash('sha256').update(received).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// One-time link codes: 8 characters without look-alikes (no 0/O, 1/I). Normalised the same way
// as public.telegram_code_hash(): uppercase, whitespace removed.
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const normalizeLinkCode = (code: string) => code.replace(/\s/g, '').toUpperCase()
export const linkCodeHash = (code: string) =>
  createHash('sha256').update(normalizeLinkCode(code), 'utf8').digest('hex')

// ---------- updates ----------

export type ChatType = 'private' | 'group' | 'supergroup' | 'channel'
export type TgUser = { id: number; username?: string; firstName: string; isBot: boolean }
export type TgChat = { id: number; type: ChatType; username?: string }

export type ParsedUpdate =
  | {
      kind: 'message'
      updateId: number
      chat: TgChat
      from: TgUser
      text: string
      messageId: number
    }
  | {
      kind: 'callback'
      updateId: number
      callbackId: string
      from: TgUser
      data: string
      chat: TgChat | null
      messageId: number | null
    }
  | { kind: 'ignored'; updateId: number | null }

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const str = (v: unknown, max = 4096) => (typeof v === 'string' && v.length <= max ? v : undefined)

const CHAT_TYPES: readonly ChatType[] = ['private', 'group', 'supergroup', 'channel']

function parseUser(v: unknown): TgUser | null {
  if (!isObj(v) || !isInt(v.id) || v.id <= 0) return null
  return {
    id: v.id,
    username: str(v.username, 64),
    firstName: str(v.first_name, 128) ?? '',
    isBot: v.is_bot === true,
  }
}

function parseChat(v: unknown): TgChat | null {
  if (!isObj(v) || !isInt(v.id)) return null
  const type = CHAT_TYPES.find((t) => t === v.type)
  if (!type) return null
  return { id: v.id, type, username: str(v.username, 64) }
}

// Only what the bot uses: text messages (commands) and inline button presses. Everything else
// (edits, photos, member updates, channel posts) is ignored.
export function parseUpdate(body: unknown): ParsedUpdate {
  if (!isObj(body)) return { kind: 'ignored', updateId: null }
  const updateId = isInt(body.update_id) ? body.update_id : null
  if (updateId === null) return { kind: 'ignored', updateId: null }

  const message = body.message
  if (isObj(message)) {
    const chat = parseChat(message.chat)
    const from = parseUser(message.from)
    const text = str(message.text)
    if (chat && from && text !== undefined && isInt(message.message_id) && !from.isBot) {
      return { kind: 'message', updateId, chat, from, text, messageId: message.message_id }
    }
    return { kind: 'ignored', updateId }
  }

  const cq = body.callback_query
  if (isObj(cq)) {
    const from = parseUser(cq.from)
    const id = str(cq.id, 128)
    const data = str(cq.data, 64)
    if (!from || !id || data === undefined || from.isBot) return { kind: 'ignored', updateId }
    const msg = isObj(cq.message) ? cq.message : null
    return {
      kind: 'callback',
      updateId,
      callbackId: id,
      from,
      data,
      chat: msg ? parseChat(msg.chat) : null,
      messageId: msg && isInt(msg.message_id) ? msg.message_id : null,
    }
  }
  return { kind: 'ignored', updateId }
}

// ---------- commands ----------

export const COMMANDS = ['start', 'help', 'link', 'stats', 'queue', 'user', 'ban', 'unban'] as const
export type CommandName = (typeof COMMANDS)[number]
export type ParsedCommand = { name: CommandName; args: string[] } | null

// "/ban@VibelyBot @siti spam" -> { name: 'ban', args: ['@siti', 'spam'] }. A command addressed to
// another bot (/stats@OtherBot) is not ours.
export function parseCommand(text: string, botUsername?: string): ParsedCommand {
  const match = /^\/([a-z_]{1,32})(?:@([A-Za-z0-9_]{3,64}))?(?:\s+([\s\S]*))?$/i.exec(text.trim())
  if (!match) return null
  const [, rawName = '', target, rest] = match
  if (target && botUsername && target.toLowerCase() !== botUsername.toLowerCase()) return null
  const name = COMMANDS.find((c) => c === rawName.toLowerCase())
  if (!name) return null
  const args = (rest ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8)
  return { name, args }
}

// ---------- callback data (max 64 bytes) ----------

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const CODE = '[a-z_]{1,24}'
export const TARGET_SHORT = {
  user: 'u',
  post: 'p',
  comment: 'c',
  random_session: 's',
  message: 'm',
  photo: 'f',
  call: 'k',
  status: 't',
} as const
export type ReportTargetType = keyof typeof TARGET_SHORT
const SHORT_TARGET = Object.fromEntries(
  Object.entries(TARGET_SHORT).map(([k, v]) => [v, k as ReportTargetType]),
) as Record<string, ReportTargetType>

export type CallbackAction =
  // selfies
  | { a: 'selfie_approve'; id: string }
  | { a: 'selfie_reject_menu'; id: string }
  | { a: 'selfie_reject'; id: string; code: string }
  | { a: 'selfie_back'; id: string }
  // reports
  | { a: 'report_dismiss'; t: ReportTargetType; id: string }
  | { a: 'report_hide'; t: ReportTargetType; id: string }
  | { a: 'report_ban_menu'; t: ReportTargetType; id: string }
  | { a: 'report_ban_confirm'; t: ReportTargetType; id: string; code: string }
  | { a: 'report_ban'; t: ReportTargetType; id: string; code: string }
  | { a: 'report_back'; t: ReportTargetType; id: string }
  // /ban and /unban commands
  | { a: 'user_ban'; id: string; code: string }
  | { a: 'user_unban'; id: string }
  | { a: 'cancel' }

const PREFIX = {
  selfie_approve: 'sa',
  selfie_reject_menu: 'sr',
  selfie_reject: 'sx',
  selfie_back: 'sb',
  report_dismiss: 'rd',
  report_hide: 'rh',
  report_ban_menu: 'rm',
  report_ban_confirm: 'rc',
  report_ban: 'rk',
  report_back: 'rb',
  user_ban: 'ub',
  user_unban: 'uu',
  cancel: 'x',
} as const satisfies Record<CallbackAction['a'], string>

export function encodeCallback(action: CallbackAction): string {
  const parts: string[] = [PREFIX[action.a]]
  if ('t' in action) parts.push(TARGET_SHORT[action.t])
  if ('id' in action) parts.push(action.id)
  if ('code' in action) parts.push(action.code)
  const data = parts.join(':')
  if (Buffer.byteLength(data) > 64) throw new Error('callback data too long')
  return data
}

const PATTERNS: [RegExp, (m: RegExpExecArray) => CallbackAction | null][] = [
  [new RegExp(`^sa:(${UUID})$`), (m) => ({ a: 'selfie_approve', id: m[1]! })],
  [new RegExp(`^sr:(${UUID})$`), (m) => ({ a: 'selfie_reject_menu', id: m[1]! })],
  [new RegExp(`^sb:(${UUID})$`), (m) => ({ a: 'selfie_back', id: m[1]! })],
  [new RegExp(`^sx:(${UUID}):(${CODE})$`), (m) => ({ a: 'selfie_reject', id: m[1]!, code: m[2]! })],
  ...(
    [
      ['rd', 'report_dismiss'],
      ['rh', 'report_hide'],
      ['rm', 'report_ban_menu'],
      ['rb', 'report_back'],
    ] as const
  ).map(
    ([p, a]) =>
      [
        new RegExp(`^${p}:([upcsmfk]):(${UUID})$`),
        (m: RegExpExecArray) => {
          const t = SHORT_TARGET[m[1]!]
          return t ? { a, t, id: m[2]! } : null
        },
      ] as [RegExp, (m: RegExpExecArray) => CallbackAction | null],
  ),
  ...(
    [
      ['rc', 'report_ban_confirm'],
      ['rk', 'report_ban'],
    ] as const
  ).map(
    ([p, a]) =>
      [
        new RegExp(`^${p}:([upcsmfk]):(${UUID}):(${CODE})$`),
        (m: RegExpExecArray) => {
          const t = SHORT_TARGET[m[1]!]
          return t ? { a, t, id: m[2]!, code: m[3]! } : null
        },
      ] as [RegExp, (m: RegExpExecArray) => CallbackAction | null],
  ),
  [new RegExp(`^ub:(${UUID}):(${CODE})$`), (m) => ({ a: 'user_ban', id: m[1]!, code: m[2]! })],
  [new RegExp(`^uu:(${UUID})$`), (m) => ({ a: 'user_unban', id: m[1]! })],
  [/^x$/, () => ({ a: 'cancel' })],
]

// Anything that does not match exactly (tampered or stale buttons) is rejected.
export function decodeCallback(data: string): CallbackAction | null {
  if (typeof data !== 'string' || data.length > 64) return null
  for (const [re, build] of PATTERNS) {
    const m = re.exec(data)
    if (m) return build(m)
  }
  return null
}

// ---------- access rules ----------

export type Access =
  | { allow: true }
  // Silently ignored: other chats, channels, bots.
  | { allow: false; reply: false; reason: string }
  // Politely refused and logged.
  | { allow: false; reply: true; reason: string }

// The moderators chat is configured either as a numeric id or as @username.
export function isModeratorsChat(chat: TgChat, configured: string): boolean {
  if (/^-?\d+$/.test(configured)) return String(chat.id) === configured
  return !!chat.username && `@${chat.username}`.toLowerCase() === configured.toLowerCase()
}

// Who may do what:
// - only the moderators chat and private chats are served, anything else is ignored;
// - `/start`, `/help` and `/link` work for anyone in a private chat (linking needs a valid code);
// - every other command and every button needs a linked moderator.
export function checkAccess(input: {
  chat: TgChat | null
  moderatorsChat: string
  linked: boolean
  command?: CommandName | null
  isCallback?: boolean
}): Access {
  const { chat, moderatorsChat, linked, command, isCallback } = input
  if (!chat) return { allow: false, reply: false, reason: 'no_chat' }
  const isPrivate = chat.type === 'private'
  const isGroup = isModeratorsChat(chat, moderatorsChat)
  if (!isPrivate && !isGroup) return { allow: false, reply: false, reason: 'foreign_chat' }
  if (!isCallback && !command) return { allow: false, reply: false, reason: 'not_a_command' }
  if (!isCallback && command === 'link') {
    return isPrivate ? { allow: true } : { allow: false, reply: true, reason: 'link_in_group' }
  }
  if (!isCallback && (command === 'start' || command === 'help') && isPrivate)
    return { allow: true }
  if (!linked) return { allow: false, reply: true, reason: 'not_linked' }
  return { allow: true }
}

// ---------- formatting ----------

// "+60123456789" -> "+•••••••••789": only the last 3 digits stay readable.
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 4) return '•••'
  return `+${'•'.repeat(digits.length - 3)}${digits.slice(-3)}`
}

// Plain-text messages (no parse_mode): user-supplied names cannot inject formatting. Control
// characters are dropped and the length is capped.
export function plain(text: string | null | undefined, max = 64): string {
  const clean = (text ?? '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

// What `/user` was given: an @username, a phone number or a profile id.
export type UserQuery =
  | { kind: 'username'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'id'; value: string }
  | null

export function parseUserQuery(raw: string | undefined): UserQuery {
  const q = (raw ?? '').trim()
  if (!q) return null
  if (new RegExp(`^${UUID}$`, 'i').test(q)) return { kind: 'id', value: q.toLowerCase() }
  if (/^\+?[\d\s()-]{6,20}$/.test(q)) {
    const digits = q.replace(/\D/g, '')
    return digits.length >= 6 ? { kind: 'phone', value: digits } : null
  }
  const name = q.toLowerCase().replace(/^@+/, '')
  return /^[a-z0-9_.]{3,20}$/.test(name) ? { kind: 'username', value: name } : null
}
