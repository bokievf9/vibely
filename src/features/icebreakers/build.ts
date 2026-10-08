// First-message suggestions from templates (no AI): common interests, the partner's prompts and
// a few "about" fields. Deterministic: the same match always gets the same suggestions.
// Pure module (type-only imports) so it runs in unit tests and on the client.
import type { PromptKey } from '@/features/profile/about-schemas'
import type { DiscoverDictionary } from '@/i18n/dictionaries/discover/en'
import type { Enums } from '@/types/database.types'

export type IcebreakerFacts = {
  // Stable per match (the match id): picks template variants.
  seed: string
  partnerName: string
  commonTags: string[]
  partnerTags: string[]
  prompts: { key: PromptKey; answer: string }[]
  job: string | null
  pets: Enums<'pets_status'> | null
}

export type IcebreakerText = {
  t: DiscoverDictionary['icebreakers']
  tagLabel: (slug: string) => string
  question: (key: PromptKey) => string
}

export const ICEBREAKER_COUNT = 3
const ANSWER_MAX = 60

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)

function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return h
}

const pick = <T>(list: readonly T[], seed: number): T | undefined => list[seed % list.length]

function short(answer: string) {
  const a = answer.replace(/\s+/g, ' ').trim()
  return a.length > ANSWER_MAX ? `${a.slice(0, ANSWER_MAX - 1).trimEnd()}…` : a
}

function promptLine(p: IcebreakerFacts['prompts'][number], text: IcebreakerText) {
  const templates: Record<string, string | undefined> = text.t.prompt
  const template = templates[p.key] ?? text.t.prompt.default
  return fill(template, { question: text.question(p.key), answer: short(p.answer) })
}

export function buildIcebreakers(facts: IcebreakerFacts, text: IcebreakerText): string[] {
  const { t } = text
  const seed = hash(facts.seed)
  const name = facts.partnerName
  const [tag1, tag2] = facts.commonTags
  const [prompt1, prompt2] = facts.prompts
  const petLine = facts.pets && facts.pets !== 'none' ? t.pets[facts.pets] : undefined

  // In order of how personal they are; the first three distinct ones win.
  const candidates = [
    tag1 && fill(pick(t.commonTag, seed) ?? '', { tag: text.tagLabel(tag1) }),
    prompt1 && promptLine(prompt1, text),
    facts.job ? fill(t.job, { job: short(facts.job) }) : petLine,
    prompt2 && promptLine(prompt2, text),
    tag2 && fill(pick(t.commonTag, seed + 1) ?? '', { tag: text.tagLabel(tag2) }),
    facts.job ? petLine : undefined,
    !tag1 && facts.partnerTags[0]
      ? fill(t.theirTag, { tag: text.tagLabel(facts.partnerTags[0]) })
      : undefined,
    ...t.fallback.map((_, i) => fill(t.fallback[(seed + i) % t.fallback.length] ?? '', { name })),
  ]

  const out: string[] = []
  for (const c of candidates) {
    if (c && !out.includes(c)) out.push(c)
    if (out.length === ICEBREAKER_COUNT) break
  }
  return out
}
