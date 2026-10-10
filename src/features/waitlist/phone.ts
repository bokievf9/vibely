// Client-safe helpers for the early access form. The full check (mobile vs landline) runs on the
// server with libphonenumber, and the database checks again (is_malaysian_mobile).

// Cities offered by the form. Must match public.waitlist_city_ok (20261009000300).
export const WAITLIST_CITIES = [
  'kuala-lumpur',
  'selangor',
  'penang',
  'johor-bahru',
  'ipoh',
  'melaka',
  'seremban',
  'kota-kinabalu',
  'kuching',
  'kuantan',
  'other',
] as const
export type WaitlistCity = (typeof WAITLIST_CITIES)[number]

export const isWaitlistCity = (value: unknown): value is WaitlistCity =>
  typeof value === 'string' && (WAITLIST_CITIES as readonly string[]).includes(value)

// What people type after the fixed "+60": "12-345 6789", "012 345 6789", "+60 12 345 6789",
// "60123456789". Returns the digits with the country code ("60123456789"), or null when the
// shape cannot be a Malaysian mobile (01x followed by 7 or 8 digits). Mirrors join_waitlist.
export function normalizeMalaysianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `6${digits}`
  else if (digits.startsWith('1')) digits = `60${digits}`
  return /^601\d{8,9}$/.test(digits) ? digits : null
}

// "60123456789" or "+60123456789" -> "+60 12-345 6789" (10- and 11-digit numbers both work).
export function formatMalaysianMobile(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^60/, '')
  if (digits.length < 9) return `+60 ${digits}`
  const head = digits.slice(0, digits.length - 7)
  const mid = digits.slice(-7, -4)
  const tail = digits.slice(-4)
  return `+60 ${head}-${mid} ${tail}`
}
