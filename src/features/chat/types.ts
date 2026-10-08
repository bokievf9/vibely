export type ChatMessage = {
  id: string
  body: string
  senderId: string
  createdAt: string
  readAt: string | null
}

// A page of older history, oldest first.
export type MessagePage = { messages: ChatMessage[]; hasMore: boolean }

export type Partner = {
  id: string
  name: string
  photo: { url: string; width: number; height: number } | null
}

export type ChatPreview = {
  matchId: string
  partner: Partner
  lastMessage: { body: string; mine: boolean; at: string } | null
  unread: number
  createdAt: string
}
