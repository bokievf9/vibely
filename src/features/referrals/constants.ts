// Invite links: https://vibelydate.com/{lang}?ref=<code> (codes: 20261008000092_referrals.sql).
export const REF_PARAM = 'ref'
// Set by src/proxy.ts on the landing page, read once when the profile is created.
export const REF_COOKIE = 'vibely_ref'
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
export const REF_CODE_RE = /^[a-z0-9]{8}$/

export function parseRefCode(value: string | null | undefined): string | null {
  const code = value?.trim().toLowerCase()
  return code && REF_CODE_RE.test(code) ? code : null
}
