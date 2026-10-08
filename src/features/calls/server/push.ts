import 'server-only'
import { after } from 'next/server'
import { getPushEnv } from '@/lib/env.server'
import { fmt, localePath } from '@/i18n/config'
import { sendToUser } from '@/features/push/send'
import type { CallKind } from '../types'

// "Incoming call from {name}". Short TTL: a ring that arrives after 30 s is useless. Runs after the
// action has responded, so a slow push service never delays the caller.
export function notifyIncomingCall(
  calleeId: string,
  call: { callId: string; matchId: string; kind: CallKind; callerName: string },
) {
  if (!getPushEnv()) return
  after(async () => {
    try {
      await sendToUser(
        calleeId,
        (dict, locale) => ({
          title: fmt(
            call.kind === 'video' ? dict.calls.push.incomingVideo : dict.calls.push.incoming,
            { name: call.callerName },
          ),
          body: dict.calls.push.body,
          url: localePath(locale, `/chats/${call.matchId}`),
          tag: `call-${call.callId}`,
        }),
        { ttl: 30 },
      )
    } catch (e) {
      console.error('[push] call', e)
    }
  })
}
