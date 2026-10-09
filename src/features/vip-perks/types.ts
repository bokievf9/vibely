// Shared by server queries and client components (no server-only imports).

export const NOTE_MAX = 200

export type Visitor = {
  id: string
  name: string
  age: number
  photo: { url: string; width: number; height: number } | null
  visitedAt: string
  liked: boolean
}

export type ProfileVisitors = { full: boolean; count: number; visitors: Visitor[] }

// A note attached to a like, as the recipient sees it.
export type IncomingNote = { id: string; firstName: string; body: string; createdAt: string }

export type SentNote = { body: string; held: boolean }
