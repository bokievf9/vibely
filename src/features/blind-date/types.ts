import type { Enums } from '@/types/database.types'

export type Side = 'a' | 'b'

// Only sent to the browser after BOTH people pressed Connect (get_blind_session, 20261009000190).
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

export type BlindSession = {
  id: string
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
}

export type BlindMessage = { id: string; body: string; mine: boolean; createdAt: string }

// Payloads broadcast by the database on random:<session id>.
export type BroadcastMessage = { id: string; body: string; from: Side; created_at: string }

export type DecideResult = {
  state: Exclude<BlindState, 'active'> | 'waiting'
  matchId: string | null
}
