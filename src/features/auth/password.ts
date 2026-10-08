import type { ErrorKey } from '@/i18n/dictionaries/en'

// Password rules for the optional username + password sign-in. Pure and client-safe: the settings
// form shows the strength meter with it, the Server Action enforces the same rules. No imports
// with the @/ alias at runtime, so the unit tests can load it directly.

export const PASSWORD_MIN = 10
// bcrypt (Supabase Auth) only reads the first 72 bytes.
export const PASSWORD_MAX_BYTES = 72

// Lowercase, trimmed, without a leading "@" (same as normalizeUsername in features/username).
export const normalizeLoginUsername = (value: string) =>
  value.trim().toLowerCase().replace(/^@+/, '')

// The login form accepts anything that could be a username; the format check stays loose so a
// typo gets the same generic "wrong username or password" as an unknown name.
export const isPlausibleUsername = (value: string) =>
  /^[a-z0-9_.]{3,20}$/.test(normalizeLoginUsername(value))

// Most common passwords and words people build them from (English, Malay, local names).
const COMMON = [
  'password',
  'passw0rd',
  'qwerty',
  'qwertyuiop',
  'asdfgh',
  'zxcvbn',
  'iloveyou',
  'letmein',
  'welcome',
  'admin',
  'login',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'princess',
  'sunshine',
  'shadow',
  'master',
  'superman',
  'batman',
  'starwars',
  'trustno1',
  'whatever',
  'freedom',
  'secret',
  'love',
  'lover',
  'baby',
  'angel',
  'hello',
  'charlie',
  'michael',
  'jessica',
  'ashley',
  'computer',
  'internet',
  'google',
  'facebook',
  'instagram',
  'tiktok',
  'whatsapp',
  'samsung',
  'iphone',
  'vibely',
  'vibelydate',
  'dating',
  'malaysia',
  'kualalumpur',
  'kuala',
  'lumpur',
  'selangor',
  'johor',
  'penang',
  'sabah',
  'sarawak',
  'sayang',
  'cinta',
  'rindu',
  'kasih',
  'sayangku',
  'cintaku',
  'bismillah',
  'allah',
  'muhammad',
  'ahmad',
  'abdullah',
  'nurul',
  'siti',
  'aisyah',
  'aminah',
  'faridah',
  'ali',
  'lim',
  'tan',
  'wong',
  'lee',
  'kumar',
  'raju',
  'merdeka',
  'harimau',
  'kucing',
  'rahsia',
  'katalaluan',
  'pasword',
  'abc',
  'abcd',
  'test',
]

// Longest first, so "sayangku" is cut before "sayang". Short names only match whole passwords.
const WORDS = COMMON.filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
}
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']

const unleet = (s: string) => s.replace(/[013457@$!]/g, (c) => LEET[c] ?? c)

function charPool(pw: string) {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9]/.test(pw)) pool += /[^\x00-\x7f]/.test(pw) ? 100 : 33
  return Math.max(pool, 10)
}

function isSequence(a: string, b: string, c: string) {
  const [x, y, z] = [a.charCodeAt(0), b.charCodeAt(0), c.charCodeAt(0)]
  if (y - x === z - y && Math.abs(y - x) === 1) return true
  const tri = a + b + c
  return KEYBOARD_ROWS.some((row) => row.includes(tri) || [...row].reverse().join('').includes(tri))
}

// What is left to guess once the predictable parts are taken out: dictionary words and years
// become one symbol, runs of one character and sequences (abc, 321, qwe) count once, and a
// repeated chunk (abcabc) counts once.
export function effectiveLength(password: string) {
  // Words are found in the de-leeted copy (p4ssw0rd) and cut from both at the same place, so
  // digits outside words stay digits for the sequence check (1234).
  let s = password.toLowerCase()
  let plain = unleet(s)
  for (const word of WORDS) {
    for (let at = plain.indexOf(word); at >= 0; at = plain.indexOf(word)) {
      s = s.slice(0, at) + '\u0001' + s.slice(at + word.length)
      plain = plain.slice(0, at) + '\u0001' + plain.slice(at + word.length)
    }
  }
  s = s.replace(/(?:19|20)\d\d/g, '\u0002')
  const unit = s.match(/^(.+?)\1+$/)?.[1]
  if (unit) s = unit
  let length = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (i > 0 && c === s[i - 1]) continue
    if (i > 1 && isSequence(s[i - 2]!, s[i - 1]!, c)) continue
    length++
  }
  return length
}

export type PasswordScore = 0 | 1 | 2 | 3 | 4
export const PASSWORD_MIN_SCORE: PasswordScore = 2

// zxcvbn-like 0-4 score from an entropy estimate of the unpredictable part.
export function passwordScore(password: string): PasswordScore {
  if (!password) return 0
  const lower = password.toLowerCase()
  if (COMMON.includes(lower) || COMMON.includes(unleet(lower).replace(/\d+$/, ''))) return 0
  const bits = effectiveLength(password) * Math.log2(charPool(password))
  if (bits < 25) return 0
  if (bits < 36) return 1
  if (bits < 50) return 2
  if (bits < 65) return 3
  return 4
}

const byteLength = (s: string) => new TextEncoder().encode(s).length

export type PasswordContext = { username?: string | null; phone?: string | null }

// True when the password contains the username or the phone number (its last 7 digits are in
// every way people write it: +60 12-345 6789, 0123456789, 123456789).
export function containsPersonal(password: string, { username, phone }: PasswordContext) {
  const lower = password.toLowerCase()
  const name = normalizeLoginUsername(username ?? '')
  if (name.length >= 3) {
    const bare = name.replace(/[._]/g, '')
    if (lower.includes(name) || (bare.length >= 3 && lower.replace(/[._\s-]/g, '').includes(bare)))
      return true
  }
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length >= 7 && password.replace(/[\s-]/g, '').includes(digits.slice(-7))) return true
  return false
}

// The first rule the new password breaks, or null when it is acceptable.
export function passwordError(password: string, context: PasswordContext = {}): ErrorKey | null {
  if (password.length < PASSWORD_MIN) return 'passwordTooShort'
  if (byteLength(password) > PASSWORD_MAX_BYTES) return 'passwordTooLong'
  if (containsPersonal(password, context)) return 'passwordPersonal'
  if (passwordScore(password) < PASSWORD_MIN_SCORE) return 'passwordWeak'
  return null
}

// How long a fresh SMS code keeps the session "recent" for setting or changing the password.
export const REAUTH_WINDOW_S = 10 * 60

type AmrEntry = { method?: string; timestamp?: number }

// True when the session was signed in with an SMS code within the window. Supabase puts the
// methods used for the session in the JWT `amr` claim; a password sign-in does not count.
export function hasRecentOtp(amr: unknown, nowS = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(amr)) return false
  return (amr as AmrEntry[]).some(
    (e) =>
      e?.method === 'otp' &&
      typeof e.timestamp === 'number' &&
      e.timestamp <= nowS + 60 &&
      nowS - e.timestamp <= REAUTH_WINDOW_S,
  )
}

// "+60 ••• 6789" for the "we sent a code to" line.
export function maskPhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 7) return ''
  return `+${digits.slice(0, 2)} ••• ${digits.slice(-4)}`
}
