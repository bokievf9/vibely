// Anonymous authors get a per-thread pseudonym ("Purple Durian") picked by the database
// (public.feed_pseudonym): indexes into the translated word lists plus a color slot.
// Pure module: also used by unit tests.

export type Pseudonym = { adj: number; noun: number; color: number }

export type PseudonymWords = { pattern: string; adjectives: string[]; nouns: string[] }

export const PSEUDONYM_ADJECTIVES = 24
export const PSEUDONYM_NOUNS = 20

// Icon per noun, same order as the noun lists.
const NOUN_EMOJI = [
  '🌰',
  '🍒',
  '🐗',
  '🦜',
  '🦌',
  '🧋',
  '🫓',
  '🍇',
  '🦧',
  '🐻',
  '🦔',
  '🌺',
  '🍢',
  '🍧',
  '🪷',
  '🦎',
  '🐦',
  '🍛',
  '🥥',
  '🌧️',
]

// Background classes for the 8 color slots.
const COLORS = [
  'bg-violet-500/25',
  'bg-amber-500/25',
  'bg-emerald-500/25',
  'bg-sky-500/25',
  'bg-rose-500/25',
  'bg-lime-500/25',
  'bg-orange-500/25',
  'bg-fuchsia-500/25',
]

const at = <T>(list: readonly T[], i: number): T | undefined =>
  list[((i % list.length) + list.length) % list.length]

export function pseudonymName(words: PseudonymWords, p: Pseudonym): string {
  const adj = at(words.adjectives, p.adj) ?? ''
  const noun = at(words.nouns, p.noun) ?? ''
  return words.pattern.replace('{adj}', adj).replace('{noun}', noun).trim()
}

export const pseudonymEmoji = (p: Pseudonym) => at(NOUN_EMOJI, p.noun) ?? '🙂'
export const pseudonymColor = (p: Pseudonym) => at(COLORS, p.color) ?? COLORS[0]

export function toPseudonym(
  adj: number | null,
  noun: number | null,
  color: number | null,
): Pseudonym | null {
  return adj === null || noun === null || color === null ? null : { adj, noun, color }
}
