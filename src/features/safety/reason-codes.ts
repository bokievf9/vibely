// Moderation reasons are stored as a code with an optional free-text note: "code" or
// "code: note". Users see the code translated (dictionary `moderation`), moderators see Russian
// labels. Older rows hold plain free text and are shown as is.
export const REJECTION_CODES = [
  'gesture_mismatch',
  'face_not_visible',
  'face_mismatch',
  'screen_photo',
  'no_face_photo',
] as const
export type RejectionCode = (typeof REJECTION_CODES)[number]

export const BAN_CODES = ['harassment', 'spam', 'scam', 'fake', 'underage', 'other'] as const
export type BanCode = (typeof BAN_CODES)[number]

const SEPARATOR = ': '

export function formatReason(code: string, note?: string): string {
  const text = note?.trim()
  return text ? `${code}${SEPARATOR}${text}` : code
}

export function parseReason<C extends string>(
  text: string,
  codes: readonly C[],
): { code: C | null; note: string } {
  const at = text.indexOf(SEPARATOR)
  const head = (at === -1 ? text : text.slice(0, at)).trim()
  const code = codes.find((c) => c === head) ?? null
  if (!code) return { code: null, note: text }
  return { code, note: at === -1 ? '' : text.slice(at + SEPARATOR.length).trim() }
}

export const hasReasonCode =
  <C extends string>(codes: readonly C[]) =>
  (text: string) =>
    parseReason(text, codes).code !== null

// "Label: note" for known codes, the raw text for legacy free-text reasons.
export function localizeReason<C extends string>(
  text: string,
  codes: readonly C[],
  labels: Record<C, string>,
): string {
  const { code, note } = parseReason(text, codes)
  if (!code) return text
  return note ? `${labels[code]}${SEPARATOR}${note}` : labels[code]
}
