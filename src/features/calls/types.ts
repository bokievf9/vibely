import type { Enums } from '@/types/database.types'

export type CallKind = Enums<'call_kind'>
export type CallStatus = Enums<'call_status'>

export const CALL_KINDS = ['audio', 'video'] as const satisfies readonly CallKind[]

// The callee has this long to pick up; then the call counts as missed (same value in SQL).
export const RING_TIMEOUT_MS = 30_000

export type CallPeer = { id: string; name: string; photoUrl: string | null }

// What the browser needs to join the LiveKit room. The token is short-lived and room-scoped.
export type CallSession = {
  callId: string
  matchId: string
  kind: CallKind
  url: string
  token: string
  peer: CallPeer
}

// A ringing call shown to the callee (Realtime "incoming" event or fetched on app open).
export type IncomingCall = {
  callId: string
  matchId: string
  kind: CallKind
  startedAt: string
  peer: CallPeer
}

// Realtime events on the private call:<user id> topic (supabase/migrations/20261008000121).
export type CallEvent =
  | { type: 'incoming'; callId: string; matchId: string | null }
  | { type: 'answered'; callId: string }
  | { type: 'ended'; callId: string; status: CallStatus }
  | { type: 'permission'; matchId: string }

// A finished (or ringing) call as an entry of the chat timeline.
export type CallEntry = {
  id: string
  kind: CallKind
  status: CallStatus
  outgoing: boolean
  startedAt: string
  durationSec: number | null
}

export type CallSettings = { consented: boolean; meAllowed: boolean; partnerAllowed: boolean }
