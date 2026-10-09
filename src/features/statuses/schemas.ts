import { z } from 'zod'
import { planTagSchema, type PlanTag } from '@/features/plans/tags'

// Live statuses ("What's your vibe?"): pure helpers shared by the client, the server actions and
// the unit tests. Limits mirror the CHECKs on public.user_statuses (20261009000271).
export const STATUS_MAX_LENGTH = 60
export const STATUS_HOURS = 3

// The emoji row of the composer: a short curated set, so a status always has one.
export const EMOJI_PICKS = [
  '☕',
  '🍜',
  '🎬',
  '🎮',
  '🏃',
  '🏋️',
  '🎤',
  '🏖️',
  '📚',
  '🛍️',
  '🎵',
  '🎨',
  '🍻',
  '✨',
  '💬',
  '😴',
] as const

// Emoji of each quick pick (the 18 plan presets, 20261009000200).
export const PLAN_EMOJI: Record<PlanTag, string> = {
  coffee: '☕',
  football: '⚽',
  mamak: '🍛',
  'morning-run': '🏃',
  gym: '🏋️',
  movie: '🎬',
  karaoke: '🎤',
  hiking: '🥾',
  study: '📚',
  'new-cafe': '🥐',
  'night-market': '🏮',
  badminton: '🏸',
  beach: '🏖️',
  gaming: '🎮',
  concert: '🎵',
  'art-gallery': '🎨',
  'food-hunt': '🍜',
  chatting: '💬',
}

const EMOJI_PART = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\p{Emoji_Modifier}|‍|️|⃣)+$/u

// One emoji (a single grapheme that is pictographic), e.g. "☕", "🏋️", "👩‍💻". Digits and plain
// letters are not accepted even though they are "Emoji_Component"s.
export function isSingleEmoji(value: string): boolean {
  if (!value || value.length > 16 || /\s/.test(value)) return false
  if (!EMOJI_PART.test(value) || !/\p{Extended_Pictographic}/u.test(value)) return false
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
    return parts.length === 1
  }
  return true
}

// Characters as Postgres counts them (char_length: code points), so "60" means the same on both
// sides even with emoji in the text.
export const codePoints = (value: string) => [...value].length

export const statusInputSchema = z.object({
  emoji: z.string().refine(isSingleEmoji, 'statusEmojiRequired'),
  text: z
    .string()
    .trim()
    .min(1, 'invalidInput')
    .refine((v) => codePoints(v) <= STATUS_MAX_LENGTH, 'statusTooLong'),
  planTag: planTagSchema.nullable(),
})

export type StatusInput = z.infer<typeof statusInputSchema>

// Whole minutes left, split for "{h} h {m} min"; null once expired.
export function timeLeft(
  expiresAt: string,
  now: number = Date.now(),
): { hours: number; minutes: number } | null {
  const ms = new Date(expiresAt).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  const total = Math.ceil(ms / 60_000)
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

// Seen state of the carousel (localStorage, one key). Pure parse / serialize so the component
// only wraps the storage calls in try/catch.
export const SEEN_KEY = 'vibely.statuses.seen'
const SEEN_MAX = 200

export function parseSeen(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [],
    )
  } catch {
    return new Set()
  }
}

// Keeps only ids that are still live (so the key never grows past the statuses on screen) and
// caps the list as a safety net.
export function serializeSeen(seen: Iterable<string>, live: Iterable<string>): string {
  const keep = new Set(live)
  return JSON.stringify([...seen].filter((id) => keep.has(id)).slice(-SEEN_MAX))
}

// Unseen first, each group in its original (newest first) order.
export function orderStatuses<T extends { id: string }>(items: T[], seen: Set<string>): T[] {
  return [...items.filter((s) => !seen.has(s.id)), ...items.filter((s) => seen.has(s.id))]
}

// Where the viewer should open when the ring of `id` is tapped (its index in the ordered list).
export function indexOf<T extends { id: string }>(items: T[], id: string): number {
  return Math.max(0, items.findIndex((s) => s.id === id))
}
