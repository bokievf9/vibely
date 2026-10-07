import DOMPurify from 'isomorphic-dompurify'

// User text is rendered as plain text (React escapes it), so strip every tag on the way in.
// This keeps stored content clean for any non-React consumer (notifications, exports).
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
}
