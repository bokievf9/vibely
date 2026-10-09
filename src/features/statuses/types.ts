import type { PlanTag } from '@/features/plans/tags'
import type { BlindState, Side } from '@/features/blind-date/types'

export type Photo = { url: string; width: number; height: number }

// The caller's own status: any moderation state except removed (get_my_status).
export type OwnStatus = {
  id: string
  emoji: string
  text: string
  planTag: PlanTag | null
  held: boolean
  createdAt: string
  expiresAt: string
}

// A status in the carousel (get_live_statuses): only visible ones of compatible people nearby.
export type LiveStatus = {
  id: string
  userId: string
  name: string
  age: number
  photo: Photo | null
  emoji: string
  text: string
  planTag: PlanTag | null
  createdAt: string
  expiresAt: string
}

// null: the feature is not available on this database yet (migration not applied).
export type StatusesState = { own: OwnStatus | null; people: LiveStatus[] } | null

// The pinned status of a conversation (snapshot taken when the reply was sent).
export type StatusContext = {
  statusId: string
  authorId: string
  emoji: string
  text: string
  planTag: PlanTag | null
  expiresAt: string
}

export type Person = { id: string; name: string; age: number; photo: Photo | null }

// A status conversation screen (get_blind_session on a kind 'status' session).
export type StatusChat = {
  id: string
  mySide: Side
  iAmAuthor: boolean
  myDecision: boolean | null
  state: BlindState
  partner: Person | null
  context: StatusContext | null
  matchId: string | null
}

// A row of "Status replies" on the Chats screen (list_status_conversations).
export type StatusConversation = {
  id: string
  state: BlindState
  iAmAuthor: boolean
  partner: Person | null
  context: StatusContext | null
  lastBody: string | null
  lastAt: string | null
  lastMine: boolean
  startedAt: string
}

export type ReplyResult = { sessionId: string; state: 'active' | BlindState }
