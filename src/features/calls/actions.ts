'use server'

import { after } from 'next/server'
import type { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fail, ok, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getViewer } from '@/features/auth/session'
import { planFail } from '@/features/plans/errors'
import { callErrorKey } from './errors'
import { callIdSchema, startCallSchema } from './schemas'
import { getLiveKitEnv, type LiveKitEnv } from './server/env'
import {
  closeCallRoom,
  createCallRoom,
  mintCallToken,
  startCallRecording,
  stopCallRecording,
} from './server/livekit'
import { loadPeer } from './server/peer'
import { notifyIncomingCall } from './server/push'
import { recordingPath } from './server/recordings'
import { RING_TIMEOUT_MS, type CallSession, type IncomingCall } from './types'

type Ready = { env: LiveKitEnv; viewerId: string; viewerName: string }

async function ready(): Promise<Ready | { error: 'callsDisabled' | 'unauthorized' }> {
  const env = getLiveKitEnv()
  if (!env) return { error: 'callsDisabled' }
  const viewer = await getViewer()
  if (!viewer?.profile) return { error: 'unauthorized' }
  return { env, viewerId: viewer.id, viewerName: viewer.profile.displayName }
}

// Rings the partner (Realtime + push) and returns the caller's room token. The database checks
// participation, verification, blocks, mutual "allow calls" and that nobody is busy.
export async function startCall(
  input: z.input<typeof startCallSchema>,
): Promise<UserResult<CallSession>> {
  const parsed = startCallSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const ctx = await ready()
  if ('error' in ctx) return fail(ctx.error)
  const { matchId, kind } = parsed.data

  const supabase = await createClient()
  const { data: callId, error } = await supabase.rpc('start_call', {
    p_match: matchId,
    p_kind: kind,
  })
  // VP402: calls need VIP on both sides (20261009000280).
  if (error || !callId) return planFail(error) ?? fail(callErrorKey(error?.code))
  const { data: call } = await supabase.from('calls').select('callee_id').eq('id', callId).single()
  const peer = await loadPeer(call?.callee_id ?? null)
  try {
    if (!peer) throw new Error('callee not visible')
    await createCallRoom(ctx.env, callId)
  } catch (e) {
    console.error('[calls] start', e)
    await supabase.rpc('end_call', { p_call: callId })
    return fail('callFailed')
  }
  notifyIncomingCall(peer.id, { callId, matchId, kind, callerName: ctx.viewerName })
  const token = await mintCallToken(ctx.env, {
    callId,
    userId: ctx.viewerId,
    name: ctx.viewerName,
    kind,
  })
  return ok({ callId, matchId, kind, url: ctx.env.url, token, peer })
}

// Picks up and starts the recording. A call that can't be recorded is not connected (safety
// protocol: every call is recorded), both sides are told it ended.
export async function answerCall(callId: string): Promise<UserResult<CallSession>> {
  const id = callIdSchema.safeParse(callId)
  if (!id.success) return fail('invalidInput')
  const ctx = await ready()
  if ('error' in ctx) return fail(ctx.error)

  const supabase = await createClient()
  const { data: status, error } = await supabase.rpc('answer_call', { p_call: id.data })
  if (error) return planFail(error) ?? fail(callErrorKey(error.code))
  if (status !== 'active') return fail('callUnavailable')
  const { data: call } = await supabase
    .from('calls')
    .select('id, match_id, kind, caller_id')
    .eq('id', id.data)
    .single()
  if (!call?.match_id) return fail('callUnavailable')

  const admin = createAdminClient()
  const path = recordingPath(call.match_id, call.id, call.kind)
  try {
    await createCallRoom(ctx.env, call.id)
    const egressId = await startCallRecording(ctx.env, { callId: call.id, kind: call.kind, path })
    await admin
      .from('calls')
      .update({ egress_id: egressId, recording_path: path, recording_status: 'pending' })
      .eq('id', call.id)
  } catch (e) {
    console.error('[calls] recording did not start', call.id, e)
    await admin.from('calls').update({ recording_status: 'failed' }).eq('id', call.id)
    await admin.rpc('finish_call', { p_call: call.id })
    after(() => closeCallRoom(ctx.env, call.id))
    return fail('callRecordingFailed')
  }

  const [peer, token] = await Promise.all([
    loadPeer(call.caller_id),
    mintCallToken(ctx.env, {
      callId: call.id,
      userId: ctx.viewerId,
      name: ctx.viewerName,
      kind: call.kind,
    }),
  ])
  if (!peer) return fail('callUnavailable')
  return ok({
    callId: call.id,
    matchId: call.match_id,
    kind: call.kind,
    url: ctx.env.url,
    token,
    peer,
  })
}

// Hang up, cancel or decline. The room is closed after the response, which also finalizes the
// recording (the egress uploads the file and reports through the webhook).
export async function endCall(callId: string): Promise<UserResult> {
  const id = callIdSchema.safeParse(callId)
  if (!id.success) return fail('invalidInput')
  const ctx = await ready()
  if ('error' in ctx) return fail(ctx.error)
  const supabase = await createClient()
  const { error } = await supabase.rpc('end_call', { p_call: id.data })
  if (error) return fail(callErrorKey(error.code))
  after(async () => {
    const { data } = await createAdminClient()
      .from('calls')
      .select('egress_id')
      .eq('id', id.data)
      .maybeSingle()
    if (data?.egress_id) await stopCallRecording(ctx.env, data.egress_id)
    await closeCallRoom(ctx.env, id.data)
  })
  return ok(undefined)
}

// The newest call ringing for the viewer: shown when the app opens from a push notification.
export async function getRingingCall(): Promise<IncomingCall | null> {
  const ctx = await ready()
  if ('error' in ctx) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('calls')
    .select('id, match_id, kind, caller_id, started_at')
    .eq('callee_id', ctx.viewerId)
    .eq('status', 'ringing')
    .gt('started_at', new Date(Date.now() - RING_TIMEOUT_MS).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.match_id) return null
  const peer = await loadPeer(data.caller_id)
  if (!peer) return null
  return {
    callId: data.id,
    matchId: data.match_id,
    kind: data.kind,
    startedAt: data.started_at,
    peer,
  }
}
