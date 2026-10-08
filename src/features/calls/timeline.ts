// Pure helpers for call entries in the chat timeline. Dependency-free (relative type imports only),
// so they are unit-tested with `node --test` (tests/unit/call-timeline.test.mjs).
import type { CallEntry, CallKind, CallStatus } from './types'

export type CallRow = {
  id: string
  kind: CallKind
  status: CallStatus
  caller_id: string | null
  started_at: string
  answered_at: string | null
  ended_at: string | null
}

const RING_MS = 30_000

export function toCallEntry(row: CallRow, viewerId: string, now = Date.now()): CallEntry {
  // A ring nobody closed (both apps gone) is shown as missed once the 30 s are over.
  const stale = row.status === 'ringing' && now - Date.parse(row.started_at) > RING_MS
  const durationSec =
    row.answered_at && row.ended_at
      ? Math.max(0, Math.round((Date.parse(row.ended_at) - Date.parse(row.answered_at)) / 1000))
      : null
  return {
    id: row.id,
    kind: row.kind,
    status: stale ? 'missed' : row.status,
    outgoing: row.caller_id === viewerId,
    startedAt: row.started_at,
    durationSec,
  }
}

// 5:12, 1:02:03
export function formatCallDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// The two item kinds of groupMessages() (src/features/chat/chat-state.ts).
type Item = { kind: 'day'; at: string } | { kind: 'message'; message: { createdAt: string } }
export type CallItem = { kind: 'call'; call: CallEntry }

// Interleaves call entries into the grouped message list: each call goes right before the first
// day separator or message that is newer than it; later calls go at the end.
export function withCalls<I extends Item>(items: I[], calls: CallEntry[]): (I | CallItem)[] {
  if (!calls.length) return items
  const queue = [...calls].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const out: (I | CallItem)[] = []
  for (const item of items) {
    const at = item.kind === 'day' ? item.at : item.message.createdAt
    while (queue[0] && queue[0].startedAt < at) out.push({ kind: 'call', call: queue.shift()! })
    out.push(item)
  }
  return [...out, ...queue.map((call) => ({ kind: 'call' as const, call }))]
}
