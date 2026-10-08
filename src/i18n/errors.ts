import type { z } from 'zod'
import { en, type ErrorKey } from './dictionaries/en'
import type { ActionResult } from '@/types/action-result'

export type UserResult<T = void> = ActionResult<T, ErrorKey>

export function isErrorKey(value: string): value is ErrorKey {
  return value in en.errors
}

// Zod messages in user-facing schemas are ErrorKeys; anything else falls back to a generic key.
export function zodErrorKey(error: z.ZodError, fallback: ErrorKey = 'invalidInput'): ErrorKey {
  const message = error.issues[0]?.message
  return message && isErrorKey(message) ? message : fallback
}

// SQLSTATE P0429 is raised by the database rate limits (swipes, messages, reports, posts),
// VS001 when a muted user tries to send something (20261009000151).
export function rateLimitedOr(code: string | undefined, fallback: ErrorKey): ErrorKey {
  if (code === 'VS001') return 'muted'
  return code === 'P0429' ? 'rateLimited' : fallback
}

export function fail(error: ErrorKey): { ok: false; error: ErrorKey } {
  return { ok: false, error }
}

export const ok = <T = void>(data: T): { ok: true; data: T } => ({ ok: true, data })
