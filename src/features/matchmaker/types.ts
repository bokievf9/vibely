// Matchmaker: A introduces two of their own matches, B and C (migration 20261009000240).

export type Photo = { url: string; width: number; height: number }

export type CardPerson = { id: string; name: string; age: number; photo: Photo | null }

// From the viewer's side. Declines are never reported: the other person keeps seeing
// 'interested' / 'pending'.
export type CardState = 'open' | 'interested' | 'matched' | 'closed' | 'pending'

type CardBase = { id: string; state: CardState; note: string | null; matchmakerName: string }

export type ReferralCard =
  | (CardBase & { role: 'b' | 'c'; person: CardPerson | null; matchId: string | null })
  | (CardBase & { role: 'matchmaker'; b: CardPerson | null; c: CardPerson | null })

// One of the matchmaker's matches in the picker.
export type Introducible = { id: string; name: string; username: string; photo: Photo | null }

export type Decision = { state: CardState; matchId: string | null }
