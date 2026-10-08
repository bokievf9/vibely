import { getTelegramEnv } from '@/features/telegram/env'
import { isValidSecret } from '@/features/telegram/protocol'
import { handleUpdate } from '@/features/telegram/webhook'

const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_BODY = 256 * 1024

// Telegram Bot API webhook (scripts/telegram/set-webhook.mjs registers it with a secret_token).
// Excluded from src/proxy.ts (no session, no locale). Telegram sends the secret in
// X-Telegram-Bot-Api-Secret-Token; anything else is 401. Errors are logged and answered with
// 200 so Telegram does not re-deliver the same update forever.
export async function POST(request: Request) {
  const env = getTelegramEnv()
  if (!env?.webhookSecret) return Response.json({ ok: false }, { status: 503, headers: NO_STORE })
  if (!isValidSecret(request.headers.get('x-telegram-bot-api-secret-token'), env.webhookSecret)) {
    return Response.json({ ok: false }, { status: 401, headers: NO_STORE })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY) return Response.json({ ok: false }, { status: 413, headers: NO_STORE })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE })
  }

  try {
    await handleUpdate(body)
  } catch (e) {
    console.error('[telegram] update failed:', e instanceof Error ? e.message : 'error')
  }
  return Response.json({ ok: true }, { headers: NO_STORE })
}
