import type { PlanTag } from '@/features/plans/tags'

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
export type StatusesState = {
  own: OwnStatus | null
  people: LiveStatus[]
  // The caller, for their own bubble (first in the carousel).
  me: { name: string; photo: Photo | null }
} | null
