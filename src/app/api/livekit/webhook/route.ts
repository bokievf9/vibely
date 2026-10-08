import { WebhookReceiver } from 'livekit-server-sdk'
import { getLiveKitEnv } from '@/features/calls/server/env'
import { applyLiveKitEvent } from '@/features/calls/server/webhook'

const MAX_BODY_BYTES = 64 * 1024

// LiveKit server → app (infra/livekit/livekit.yaml `webhook.urls`). The Authorization header is a
// JWT signed with the API secret over the body's sha256; anything else is rejected.
// Excluded from src/proxy.ts (no session, no locale redirect).
export async function POST(request: Request) {
  const env = getLiveKitEnv()
  if (!env) return new Response(null, { status: 404 })
  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 })

  const receiver = new WebhookReceiver(env.apiKey, env.apiSecret)
  let event
  try {
    event = await receiver.receive(body, request.headers.get('authorization') ?? undefined)
  } catch {
    return new Response(null, { status: 401 })
  }
  try {
    await applyLiveKitEvent(env, event)
  } catch (e) {
    console.error('[calls] webhook', event.event, e)
    return new Response(null, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
