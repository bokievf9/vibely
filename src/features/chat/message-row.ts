import { REACTIONS, type ChatMessage, type Reaction, type ReactionEmoji } from './types'

export const MESSAGE_COLUMNS =
  'id, body, sender_id, created_at, read_at, edited_at, deleted_at, reply_to, image_path, image_width, image_height'

export type MessageRow = {
  id: string
  body: string | null
  sender_id: string
  created_at: string
  read_at: string | null
  edited_at: string | null
  deleted_at: string | null
  reply_to: string | null
  image_path: string | null
  image_width: number | null
  image_height: number | null
}

// Plain row → message without the extras that need a query (signed image URL, quoted message).
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
  image:
    m.image_path && m.image_width && m.image_height
      ? { path: m.image_path, url: null, width: m.image_width, height: m.image_height }
      : null,
})

export const REACTION_COLUMNS = 'message_id, user_id, emoji'

export type ReactionRow = { message_id: string; user_id: string; emoji: string | null }

const isReaction = (e: string | null): e is ReactionEmoji =>
  (REACTIONS as readonly (string | null)[]).includes(e)

export const toReaction = (r: ReactionRow): Reaction | null =>
  isReaction(r.emoji) ? { messageId: r.message_id, userId: r.user_id, emoji: r.emoji } : null

export const toReactions = (rows: ReactionRow[]): Reaction[] =>
  rows.flatMap((r) => toReaction(r) ?? [])
