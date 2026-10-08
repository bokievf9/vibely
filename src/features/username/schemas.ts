import { z } from 'zod'
import type { ErrorKey } from '@/i18n/dictionaries/en'

// Mirrors public.username_error() in 20261009000140_usernames.sql: 3-20 of [a-z0-9_.],
// no leading/trailing dot, no two dots in a row. Reserved names are only known to the database.
export const USERNAME_MAX = 20
export const USERNAME_RE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9_.]{3,20}$/

// Lowercase, trimmed, without a leading "@" (the database normalises the same way).
export const normalizeUsername = (value: string) => value.trim().toLowerCase().replace(/^@+/, '')

export const isValidUsername = (value: string) => USERNAME_RE.test(normalizeUsername(value))

const e = (key: ErrorKey) => ({ error: key })

export const usernameSchema = z
  .string()
  .max(40, e('usernameInvalid'))
  .transform(normalizeUsername)
  .pipe(z.string().regex(USERNAME_RE, e('usernameInvalid')))

// What username_status() answers (plus the client-only "invalid" short-cut).
export type UsernameStatus = 'ok' | 'current' | 'invalid' | 'reserved' | 'taken'

export const SEARCH_MIN = 2
export const searchQuerySchema = z.string().trim().min(SEARCH_MIN).max(40)

export type SearchResult = {
  id: string
  username: string
  name: string
  age: number
  city: string | null
  photo: { url: string; width: number; height: number } | null
}

export type UsernameSettings = {
  username: string
  // When the 30-day cooldown ends; null when the username can be changed now.
  nextChangeAt: string | null
  searchable: boolean
}
