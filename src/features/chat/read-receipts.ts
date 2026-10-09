import { z } from 'zod'

// Read receipts (20261009000290). `legacy`: the database predates the migration, messages.read_at
// is still written by the reader and shown as before ("Seen" under the last own message).
// `gated`: the read state lives in match_reads and the sender sees it only with the
// read_receipts perk and receipts on at both ends (match_read_state); `enabled` false means the
// viewer sees "sent" ticks only.
export type ReadReceipts =
  { mode: 'legacy' } | { mode: 'gated'; enabled: boolean; seenUpTo: string | null }

export type Receipt = 'sent' | 'seen' | null

export const LEGACY_RECEIPTS: ReadReceipts = { mode: 'legacy' }

const stateSchema = z.object({ enabled: z.boolean(), seen_up_to: z.string().nullable() })

// match_read_state() → ReadReceipts; anything unexpected (RPC missing) is the legacy mode.
export function toReadReceipts(data: unknown, error: unknown): ReadReceipts {
  if (error) return LEGACY_RECEIPTS
  const parsed = stateSchema.safeParse(data)
  return parsed.success
    ? { mode: 'gated', enabled: parsed.data.enabled, seenUpTo: parsed.data.seen_up_to }
    : LEGACY_RECEIPTS
}

// Payload of the 'read' broadcast on match:<id> (sent only to a sender allowed to see it).
export const readBroadcastSchema = z.object({ reader: z.string(), at: z.string() })

type Own = { id: string; createdAt: string; readAt: string | null; local?: string }

// Tick under an own message. Optimistic (local) messages have their own pending/failed row.
export function receiptFor(m: Own, lastOwnId: string | undefined, r: ReadReceipts): Receipt {
  if (m.local) return null
  if (r.mode === 'legacy') return m.id === lastOwnId && m.readAt ? 'seen' : null
  if (!r.enabled) return 'sent'
  return r.seenUpTo && Date.parse(m.createdAt) <= Date.parse(r.seenUpTo) ? 'seen' : 'sent'
}

// The later of two read-up-to times (a stale resync must not move the ticks back).
export function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}
