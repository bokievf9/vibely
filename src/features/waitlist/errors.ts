// Error keys of the early access form (strings in landing.waitlist.errors, en/ms/ru).
export const WAITLIST_ERRORS = [
  'phoneInvalid',
  'phoneNotMalaysia',
  'phoneNotMobile',
  'cityInvalid',
  'consentRequired',
  'captchaFailed',
  'rateLimited',
  'unavailable',
  'generic',
] as const
export type WaitlistError = (typeof WAITLIST_ERRORS)[number]

export type WaitlistResult = { ok: true } | { ok: false; error: WaitlistError }

// A PostgREST error from join_waitlist -> the key to show.
//   P0429           rate limits (per number or global)
//   22023 + hint    validation in the database (phone, consent, city)
//   PGRST202/42883  the function is not deployed yet: the form says sign-up is not open yet
export function waitlistErrorFromDb(error: { code?: string; hint?: string | null }): WaitlistError {
  if (error.code === 'P0429') return 'rateLimited'
  if (error.code === 'PGRST202' || error.code === '42883') return 'unavailable'
  if (error.code === '22023') {
    if (error.hint === 'consent') return 'consentRequired'
    if (error.hint === 'city') return 'cityInvalid'
    return 'phoneNotMobile'
  }
  return 'generic'
}
