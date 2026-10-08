import type { ErrorKey } from '@/i18n/dictionaries/en'

// SQLSTATEs raised by the call RPCs (supabase/migrations/20261008000121_calls_rpc.sql).
const CODES: Record<string, ErrorKey> = {
  VC001: 'callsNotAllowed',
  VC002: 'callsConsentRequired',
  VC003: 'callBusy',
  P0429: 'rateLimited',
  '42501': 'callUnavailable',
}

export const callErrorKey = (code: string | undefined): ErrorKey =>
  (code && CODES[code]) || 'callFailed'
