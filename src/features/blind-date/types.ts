import type { Enums } from '@/types/database.types'
import type { Locale } from '@/i18n/config'
import type { Pseudonym } from '@/features/feed/pseudonym'

export type Side = 'a' | 'b'

// Only sent to the browser after BOTH people pressed Connect (get_blind_session, 20261009000190),
// or from the first message of a prompt conversation (revealed_from_start, 20261009000220).
export type RevealedPartner = {
  id: string
  name: string
  age: number
  city: string | null
  bio: string | null
  relationshipGoal: Enums<'relationship_goal'> | null
  jobTitle: string | null
  photo: { url: string; width: number; height: number } | null
}

// active: chatting · matched: both connected · passed: I passed · ended: they moved on (or a
// moderator ended it). The partner's own decision is never exposed.
export type BlindState = 'active' | 'matched' | 'passed' | 'ended'

// blind: a blind date · post: "Reply privately" on a feed post · prompt: "Say hi" from the
// question of the day · status: a reply to a live status (20261009000271). Prompt and status
// conversations show names and photos from the start.
export type SessionKind = 'blind' | 'post' | 'prompt' | 'status'

// The author of a post as the post shows them to the replier ("As me" posts only).
export type ContextAuthor = {
  id: string
  name: string
  username: string | null
  age: number | null
  verified: boolean
  photoUrl: string | null
}

export type PostContext = {
  kind: 'post'
  postId: string | null
  // Null once the post is deleted or hidden.
  body: string | null
  iAmAuthor: boolean
  // What the replier sees of the author: the real card ("As me") or the thread pseudonym.
  author: ContextAuthor | null
  authorPseudonym: Pseudonym | null
}

export type PromptContext = {
  kind: 'prompt'
  promptId: string
  question: Record<Locale, string>
  options: Record<Locale, string[]>
  myOption: number | null
  partnerOption: number | null
}

// The live status replied to, as the replier saw it (a snapshot: the status itself expires).
export type StatusContext = {
  kind: 'status'
  statusId: string | null
  emoji: string
  // Null once a moderator removed the status.
  text: string | null
  planTag: string | null
  expiresAt: string | null
  iAmAuthor: boolean
}

export type SessionContext = PostContext | PromptContext | StatusContext | null

export type BlindSession = {
  id: string
  kind: SessionKind
  mySide: Side
  myAlias: number
  partnerAlias: number
  // My own choice: true after Connect ("waiting for them"), false after Pass, null undecided.
  myDecision: boolean | null
  state: BlindState
  commonTags: string[]
  partner: RevealedPartner | null
  matchId: string | null
  // The Blind Dating Night this date happened in (20261009000210), or null.
  eventId: string | null
  context: SessionContext
  // Messages sent so far by each side (the "Reveal identity" unlock on post conversations).
  myMessages: number
  partnerMessages: number
  revealedFromStart: boolean
}

export type BlindMessage = { id: string; body: string; mine: boolean; createdAt: string }

// Payloads broadcast by the database on random:<session id>.
export type BroadcastMessage = { id: string; body: string; from: Side; created_at: string }

export type DecideResult = {
  state: Exclude<BlindState, 'active'> | 'waiting'
  matchId: string | null
}

// A row of the "Private replies" section of the Chats screen (list_my_conversations).
export type ConversationPreview = {
  id: string
  kind: Exclude<SessionKind, 'blind'>
  partnerAlias: number
  context: SessionContext
  // Only for prompt and status conversations (revealed from the start).
  partner: { id: string; name: string; age: number; photo: RevealedPartner['photo'] } | null
  lastBody: string | null
  lastAt: string | null
  lastMine: boolean
  startedAt: string
}
