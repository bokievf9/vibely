import 'server-only'
import { EgressStatus, type WebhookEvent } from 'livekit-server-sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LiveKitEnv } from './env'
import { callIdFromRoom, closeCallRoom } from './livekit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Applies a verified LiveKit webhook to the calls table (service role):
//   egress_started / egress_ended   recording status, size
//   participant_left / room_finished  the call is over for both (a user identity is their uuid;
//                                     the hidden recorder has another identity and is ignored)
export async function applyLiveKitEvent(env: LiveKitEnv, event: WebhookEvent): Promise<void> {
  const db = createAdminClient()
  switch (event.event) {
    case 'egress_started': {
      const callId = callIdFromRoom(event.egressInfo?.roomName)
      if (!callId || !event.egressInfo) return
      await db
        .from('calls')
        .update({ recording_status: 'recording', egress_id: event.egressInfo.egressId })
        .eq('id', callId)
        .in('recording_status', ['none', 'pending'])
      return
    }
    case 'egress_ended': {
      const info = event.egressInfo
      const callId = callIdFromRoom(info?.roomName)
      if (!callId || !info) return
      const file = info.fileResults[0]
      const complete = info.status === EgressStatus.EGRESS_COMPLETE && !!file && file.size > 0n
      if (!complete) console.error('[calls] recording failed', callId, info.error)
      await db
        .from('calls')
        .update({
          recording_status: complete ? 'ready' : 'failed',
          recording_bytes: file ? Number(file.size) : null,
        })
        .eq('id', callId)
        .neq('recording_status', 'purged')
      return
    }
    case 'participant_left':
    case 'room_finished': {
      const callId = callIdFromRoom(event.room?.name)
      if (!callId) return
      if (event.event === 'participant_left' && !UUID.test(event.participant?.identity ?? ''))
        return
      const { data: status } = await db.rpc('finish_call', { p_call: callId })
      if (event.event === 'participant_left' && status) await closeCallRoom(env, callId)
      return
    }
    default:
      return
  }
}
