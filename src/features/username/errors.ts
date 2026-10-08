import type { ErrorKey } from '@/i18n/dictionaries/en'

type DbError = { code?: string; message?: string } | null | undefined

// Error codes raised by set_username() and the profiles_username trigger
// (20261009000140_usernames.sql). Null when the error is not about the username.
export function usernameErrorKey(error: DbError): ErrorKey | null {
  const message = error?.message ?? ''
  if (message.includes('username_cooldown')) return 'usernameCooldown'
  if (message.includes('username_reserved')) return 'usernameReserved'
  if (message.includes('username_invalid')) return 'usernameInvalid'
  if (message.includes('username_taken') || message.includes('profiles_username_key'))
    return 'usernameTaken'
  if (error?.code === '23514' && message.includes('profiles_username_format'))
    return 'usernameInvalid'
  return null
}
