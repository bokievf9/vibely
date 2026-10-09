// SQLSTATEs of the Duo Dating RPCs (20261009000261) → user-facing error keys. Dependency-free
// (relative type import only), unit-tested in tests/unit/duo.test.mjs.
import type { ErrorKey } from '../../i18n/dictionaries/en'

const BY_CODE: Record<string, ErrorKey> = {
  VD001: 'duoActive',
  VD002: 'duoPartnerBusy',
  VD003: 'duoInviteInvalid',
  VD004: 'duoNotAvailable',
  P0002: 'duoNone',
  '23514': 'duoBioTooLong',
  '42501': 'unauthorized',
  P0429: 'rateLimited',
  VS001: 'muted',
}

export function duoErrorKey(code: string | undefined, fallback: ErrorKey = 'generic'): ErrorKey {
  return (code && BY_CODE[code]) || fallback
}

// Group messages: an RLS or membership failure means the caller left (or was removed).
export function groupSendErrorKey(code: string | undefined): ErrorKey {
  if (code === '42501') return 'groupNotMember'
  if (code === '23514') return 'messageTooLong'
  return duoErrorKey(code)
}

// PGRST202: the function does not exist on this database (migration not applied yet).
export const isMissingFunction = (code: string | undefined) => code === 'PGRST202'

// The undo window of a team like (duo_undo_like: 1 hour). Whole minutes left, at least 1 while open.
export const UNDO_WINDOW_MS = 60 * 60 * 1000

export function undoMinutesLeft(createdAt: string, now: number = Date.now()): number {
  const left = new Date(createdAt).getTime() + UNDO_WINDOW_MS - now
  return left > 0 ? Math.max(1, Math.ceil(left / 60_000)) : 0
}

export const DUO_BIO_MAX = 120

// An invite link code (duo_teams.invite_code): 8 lowercase letters or digits.
export const INVITE_CODE_RE = /^[a-z0-9]{8}$/
