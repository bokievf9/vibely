// Simple "profile completeness" heuristic for the nudge on the own profile page.
// Pure and dependency-free: unit-tested with `node --test` (tests/unit/completeness.test.mjs).
// Religion is deliberately NOT counted: it is PDPA sensitive data and must never be nudged for.
export type CompletenessInput = {
  photoCount: number
  bio: string
  promptCount: number
  // The non-sensitive "about" fields, filled or not.
  aboutFilled: boolean[]
}

export type CompletenessHint = 'photos' | 'bio' | 'prompts' | 'about'

const WEIGHTS: Record<CompletenessHint, number> = { photos: 30, prompts: 30, about: 25, bio: 15 }
const TARGET = { photos: 3, prompts: 3, about: 5 }

export function profileCompleteness(input: CompletenessInput): {
  percent: number
  hint: CompletenessHint | null
} {
  const filledAbout = input.aboutFilled.filter(Boolean).length
  const share: Record<CompletenessHint, number> = {
    photos: Math.min(input.photoCount, TARGET.photos) / TARGET.photos,
    prompts: Math.min(input.promptCount, TARGET.prompts) / TARGET.prompts,
    about: Math.min(filledAbout, TARGET.about) / TARGET.about,
    bio: input.bio.trim() ? 1 : 0,
  }
  const keys = Object.keys(WEIGHTS) as CompletenessHint[]
  const percent = Math.round(keys.reduce((sum, k) => sum + WEIGHTS[k] * share[k], 0))
  // The most valuable missing piece; ties keep the WEIGHTS order (photos, then prompts).
  let hint: CompletenessHint | null = null
  let missing = 0
  for (const k of keys) {
    const m = WEIGHTS[k] * (1 - share[k])
    if (m > missing) [hint, missing] = [k, m]
  }
  return { percent, hint }
}
