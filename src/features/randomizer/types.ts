import type { Enums } from '@/types/database.types'

export type Side = 'a' | 'b'

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

// The partner stays anonymous (null) until both sides agree to reveal.
export type RandomSession = {
  id: string
  mySide: Side
  myRevealed: boolean
  partnerRevealed: boolean
  commonTags: string[]
  partner: RevealedPartner | null
  matchId: string | null
}

export type RandomMessage = { id: string; body: string; mine: boolean; createdAt: string }

// Payloads broadcast by the database on random:<session id>.
export type BroadcastMessage = { id: string; body: string; from: Side; created_at: string }
