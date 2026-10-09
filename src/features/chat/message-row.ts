import {
  REACTIONS,
  type ChatMedia,
  type ChatMessage,
  type MediaKind,
  type Reaction,
  type ReactionEmoji,
} from './types'
import { messageKindOf, referralIdOf } from './message-kind'

// Every column: `kind` and `payload` (20261009000240) must not break a chat on a database where
// that migration is not applied yet, and a row is small anyway.
export const MESSAGE_COLUMNS = '*'

export type MessageRow = {
  id: string
  body: string | null
  sender_id: string
  created_at: string
  read_at: string | null
  edited_at: string | null
  deleted_at: string | null
  reply_to: string | null
  image_width: number | null
  image_height: number | null
  media_kind: string | null
  media_path: string | null
  media_duration_ms: number | null
  waveform: number[] | null
  media_expired_at: string | null
  // Absent before 20261009000240.
  kind?: string | null
  payload?: unknown
}

const isMediaKind = (k: string | null): k is MediaKind =>
  k === 'image' || k === 'voice' || k === 'video'

export const mediaKindOf = (m: Pick<MessageRow, 'media_kind'>): MediaKind | null =>
  isMediaKind(m.media_kind) ? m.media_kind : null

function toMedia(m: MessageRow): ChatMedia | null {
  const path = m.media_path
  const kind = mediaKindOf(m)
  if (!path || !kind) return null
  if (kind === 'image') {
    return m.image_width && m.image_height
      ? { kind, path, url: null, width: m.image_width, height: m.image_height }
      : null
  }
  const durationMs = m.media_duration_ms ?? 0
  return kind === 'voice'
    ? { kind, path, url: null, durationMs, waveform: m.waveform }
    : { kind, path, url: null, durationMs }
}

// Plain row → message without the extras that need a query (signed media URL, quoted message).
export const toChatMessage = (m: MessageRow): ChatMessage => ({
  id: m.id,
  body: m.body,
  senderId: m.sender_id,
  createdAt: m.created_at,
  readAt: m.read_at,
  editedAt: m.edited_at,
  deletedAt: m.deleted_at,
  replyTo: m.reply_to,
  reply: null,
  media: toMedia(m),
  expiredMedia: m.media_expired_at ? mediaKindOf(m) : null,
  kind: messageKindOf(m),
  referralId: referralIdOf(m),
})

export const REACTION_COLUMNS = 'message_id, user_id, emoji'

export type ReactionRow = { message_id: string; user_id: string; emoji: string | null }

const isReaction = (e: string | null): e is ReactionEmoji =>
  (REACTIONS as readonly (string | null)[]).includes(e)

export const toReaction = (r: ReactionRow): Reaction | null =>
  isReaction(r.emoji) ? { messageId: r.message_id, userId: r.user_id, emoji: r.emoji } : null

export const toReactions = (rows: ReactionRow[]): Reaction[] =>
  rows.flatMap((r) => toReaction(r) ?? [])
