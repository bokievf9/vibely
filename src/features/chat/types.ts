export type ChatImage = { path: string; url: string | null; width: number; height: number }

// Enough of a quoted message to render the reply header when the original isn't loaded.
export type ReplyPreview = {
  id: string
  senderId: string
  body: string | null
  hasImage: boolean
  deleted: boolean
}

export type ChatMessage = {
  id: string
  body: string | null
  senderId: string
  createdAt: string
  readAt: string | null
  editedAt: string | null
  deletedAt: string | null
  replyTo: string | null
  reply: ReplyPreview | null
  image: ChatImage | null
}

export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const
export type ReactionEmoji = (typeof REACTIONS)[number]

export type Reaction = { messageId: string; userId: string; emoji: ReactionEmoji }

// A page of older history, oldest first.
export type MessagePage = { messages: ChatMessage[]; reactions: Reaction[]; hasMore: boolean }

export type Partner = {
  id: string
  name: string
  photo: { url: string; width: number; height: number } | null
}

export type PreviewKind = 'text' | 'photo' | 'deleted'

export type ChatPreview = {
  matchId: string
  partner: Partner
  lastMessage: { body: string | null; kind: PreviewKind; mine: boolean; at: string } | null
  unread: number
  createdAt: string
}

export const EDIT_WINDOW_MS = 15 * 60 * 1000

export const CHAT_MEDIA_BUCKET = 'chat-media'
