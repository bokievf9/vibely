// Message kinds (20261009000240). Dependency-free (type imports only), so they are unit-tested
// with `node --test` (tests/unit/matchmaker.test.mjs). Rows from a database without the `kind`
// and `payload` columns read as plain text.
import type { MessageKind, PreviewKind } from './types'

type KindRow = { kind?: string | null; payload?: unknown }

export const messageKindOf = (m: KindRow): MessageKind =>
  m.kind === 'referral' || m.kind === 'system' ? m.kind : 'text'

// The referral behind a card or a pinned note; null for plain messages and malformed payloads.
export function referralIdOf(m: KindRow): string | null {
  if (messageKindOf(m) === 'text') return null
  const p = m.payload
  const id =
    p && typeof p === 'object' && 'referral_id' in p
      ? (p as { referral_id?: unknown }).referral_id
      : null
  return typeof id === 'string' ? id : null
}

type PreviewRow = {
  body: string | null
  media_kind: string | null
  media_expired_at: string | null
  deleted_at: string | null
  kind?: string | null
}

const MEDIA_PREVIEW: Record<string, PreviewKind> = { image: 'photo', voice: 'voice', video: 'video' }

// What the chat list says about the last message. A row with neither text nor media that is not
// deleted or expired is a referral card (also on a database without the `kind` column yet).
export function previewKindOf(m: PreviewRow): PreviewKind {
  if (m.deleted_at) return 'deleted'
  if (m.media_expired_at) return 'expired'
  const media = MEDIA_PREVIEW[m.media_kind ?? '']
  if (media) return media
  if (m.kind === 'referral' || (!m.body && !m.media_kind)) return 'referral'
  return 'text'
}
