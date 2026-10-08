import type { ChatMessage } from './types'

export const MESSAGE_COLUMNS = 'id, body, sender_id, created_at, read_at'

export type MessageRow = {
  id: string
  body: string
  sender_id: string
  created_at: string
  read_at: string | null
}

export const toChatMessage = (m: MessageRow): ChatMessage => ({
  id: m.id,
  body: m.body,
  senderId: m.sender_id,
  createdAt: m.created_at,
  readAt: m.read_at,
})
