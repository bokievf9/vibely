// Registers the moderation bot's webhook and command list with Telegram.
//   node scripts/telegram/set-webhook.mjs /var/www/vibely/shared/.env.production [--drop-pending] [--delete]
// Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_SITE_URL from the given env
// file (not from the shell, so nothing lands in the shell history). Never prints the token or
// the secret: only the webhook URL, Telegram's status and the bot's @username.
//   --drop-pending  discard updates queued while the webhook was down
//   --delete        remove the webhook instead (the bot stops receiving buttons and commands)
import { readFileSync } from 'node:fs'

const [file, ...flags] = process.argv.slice(2)
if (!file) {
  console.error(
    'Usage: node scripts/telegram/set-webhook.mjs <path to env file> [--drop-pending] [--delete]',
  )
  process.exit(1)
}

// Minimal .env parser: KEY=value, optional quotes, # comments.
function parseEnv(text) {
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    let value = m[2]
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    env[m[1]] = value
  }
  return env
}

let env
try {
  env = parseEnv(readFileSync(file, 'utf8'))
} catch {
  console.error(`Cannot read ${file}`)
  process.exit(1)
}

const token = env.TELEGRAM_BOT_TOKEN
const secret = env.TELEGRAM_WEBHOOK_SECRET
const site = (env.NEXT_PUBLIC_SITE_URL || 'https://vibelydate.com').replace(/\/+$/, '')
const missing = [
  !/^\d+:[\w-]+$/.test(token ?? '') && 'TELEGRAM_BOT_TOKEN',
  !/^[A-Za-z0-9_-]{32,256}$/.test(secret ?? '') &&
    'TELEGRAM_WEBHOOK_SECRET (32-256 of A-Z a-z 0-9 _ -)',
].filter(Boolean)
if (missing.length) {
  console.error(`Missing or invalid in ${file}: ${missing.join(', ')}`)
  process.exit(1)
}
if (!site.startsWith('https://')) {
  console.error('NEXT_PUBLIC_SITE_URL must be https:// (Telegram only calls HTTPS webhooks)')
  process.exit(1)
}

async function tg(method, params = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ description: e.name }) }))
  const data = await res.json().catch(() => ({}))
  if (!data.ok) {
    console.error(`${method} failed: ${res.status} ${String(data.description ?? '').slice(0, 200)}`)
    process.exit(1)
  }
  return data.result
}

const me = await tg('getMe')
console.log(`Bot: @${me.username} (set TELEGRAM_BOT_USERNAME=${me.username})`)
if (me.can_read_all_group_messages) {
  console.warn('Warning: privacy mode is OFF. Turn it on in @BotFather (/setprivacy -> Enable).')
}

if (flags.includes('--delete')) {
  await tg('deleteWebhook', { drop_pending_updates: flags.includes('--drop-pending') })
  console.log('Webhook deleted.')
  process.exit(0)
}

const url = `${site}/api/telegram/webhook`
await tg('setWebhook', {
  url,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query'],
  max_connections: 10,
  drop_pending_updates: flags.includes('--drop-pending'),
})
console.log(`Webhook set: ${url}`)

// Keep in sync with BOT_COMMANDS in src/features/telegram/commands.ts.
const commands = [
  { command: 'stats', description: 'Очереди и статистика за сегодня' },
  { command: 'queue', description: 'Самые старые селфи и жалобы' },
  { command: 'user', description: 'Пользователь: /user @username, телефон или id' },
  { command: 'ban', description: 'Бан: /ban @username причина' },
  { command: 'unban', description: 'Разбан: /unban @username' },
  { command: 'link', description: 'Привязать аккаунт модератора: /link КОД' },
  { command: 'help', description: 'Справка' },
]
await tg('setMyCommands', { commands })
console.log(`Commands set: ${commands.map((c) => `/${c.command}`).join(' ')}`)

const info = await tg('getWebhookInfo')
console.log(
  `Webhook status: pending ${info.pending_update_count}` +
    (info.last_error_message
      ? `, last error: ${String(info.last_error_message).slice(0, 200)}`
      : ', no errors'),
)
