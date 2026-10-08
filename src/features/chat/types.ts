export type MediaKind = 'image' | 'voice' | 'video'

export type ChatImage = {
  kind: 'image'
  path: string
  url: string | null
  width: number
  height: number
}
export type ChatVoice = {
  kind: 'voice'
  path: string
  url: string | null
  durationMs: number
  waveform: number[] | null
}
export type ChatVideo = { kind: 'video'; path: string; url: string | null; durationMs: number }
export type ChatMedia = ChatImage | ChatVoice | ChatVideo

// Enough of a quoted message to render the reply header when the original isn't loaded.
export type ReplyPreview = {
  id: string
  senderId: string
  body: string | null
  mediaKind: MediaKind | null
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
  media: ChatMedia | null
  // Kind of a media file purged after 90 days (retention): shown as a placeholder.
  expiredMedia: MediaKind | null
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

export type PreviewKind = 'text' | 'photo' | 'voice' | 'video' | 'expired' | 'deleted'

export type ChatPreview = {
  matchId: string
  partner: Partner
  lastMessage: { body: string | null; kind: PreviewKind; mine: boolean; at: string } | null
  unread: number
  createdAt: string
}

export const EDIT_WINDOW_MS = 15 * 60 * 1000

export const CHAT_MEDIA_BUCKET = 'chat-media'
