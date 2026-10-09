// Pure helpers for the referral card and the picker. Dependency-free (relative type imports
// only), so they are unit-tested with `node --test` (tests/unit/matchmaker.test.mjs).
import type { MatchmakerDictionary } from '@/i18n/dictionaries/matchmaker/en'
import type { CardPerson, Introducible, ReferralCard } from './types'

// Longest note the matchmaker can add (also enforced by create_referral).
export const NOTE_MAX = 200

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)

// Whitespace runs collapse, the note is trimmed and cut to the limit; '' means "no note".
export function normalizeNote(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)
}

// Name or username search in the picker (case-insensitive, prefix of any word or of the handle).
export function filterIntroducible(list: Introducible[], query: string): Introducible[] {
  const q = query.trim().toLowerCase().replace(/^@/, '')
  if (!q) return list
  return list.filter(
    (p) =>
      p.username.toLowerCase().startsWith(q) ||
      p.name.toLowerCase().startsWith(q) ||
      p.name
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.startsWith(q)),
  )
}

// The person shown on the card. For the matchmaker it depends on which chat the card sits in:
// the one who is not the chat partner.
export function cardPerson(card: ReferralCard, partnerId: string): CardPerson | null {
  if (card.role !== 'matchmaker') return card.person
  return card.b?.id === partnerId ? card.c : card.b
}

export const canDecide = (card: ReferralCard) => card.role !== 'matchmaker' && card.state === 'open'

export type CardCopy = { title: string; status: string | null; showActions: boolean }

// Title and status line of the card from the viewer's side. `partnerName` is the chat partner.
export function cardCopy(
  dict: MatchmakerDictionary,
  card: ReferralCard,
  partnerName: string,
): CardCopy {
  const person = card.role === 'matchmaker' ? null : card.person
  if (card.role === 'matchmaker') {
    const other = cardPerson(card, '')
    const first = card.b?.name ?? ''
    const second = card.c?.name ?? other?.name ?? ''
    const title = fill(dict.cardTitleMine, { name: first, other: second })
    const status =
      card.state === 'matched'
        ? dict.matchedMine
        : card.state === 'closed'
          ? dict.unavailable
          : dict.pending
    return { title, status, showActions: false }
  }
  if (!person) return { title: dict.unavailable, status: null, showActions: false }
  const title = fill(dict.cardTitle, { name: partnerName })
  switch (card.state) {
    case 'open':
      return { title, status: null, showActions: true }
    case 'interested':
      return { title, status: fill(dict.waiting, { name: person.name }), showActions: false }
    case 'matched':
      return { title, status: fill(dict.matched, { name: person.name }), showActions: false }
    case 'closed':
      return { title, status: dict.closed, showActions: false }
    default:
      return { title, status: dict.pending, showActions: false }
  }
}
