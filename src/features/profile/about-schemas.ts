import { z } from 'zod'
import { Constants, type Enums } from '@/types/database.types'
import type { ErrorKey } from '@/i18n/dictionaries/en'

const e = (key: ErrorKey) => ({ error: key })
const enums = Constants.public.Enums

// Keys of the fixed prompt list (CHECK constraint in 20261008000056_profile_prompts.sql).
export const PROMPT_KEYS = [
  'ideal_weekend',
  'way_to_heart',
  'mamak_order',
  'weirdly_good_at',
  'two_truths_lie',
  'simple_pleasures',
  'lets_debate',
  'perfect_first_date',
  'looking_for',
  'karaoke_song',
  'travel_story',
  'green_flags',
] as const
export type PromptKey = (typeof PROMPT_KEYS)[number]

export const MAX_PROMPTS = 3
export const PROMPT_MAX_LENGTH = 200
export const MAX_LANGUAGES = 6
export const JOB_MAX_LENGTH = 60
export const HEIGHT_MIN_CM = 140
export const HEIGHT_MAX_CM = 220

// Optional "about me" fields. Every field is nullable: null means "not shown".
// `religion` is PDPA sensitive data: only ever displayed on the profile, never used elsewhere.
export const aboutSchema = z.object({
  relationshipGoal: z.enum(enums.relationship_goal).nullable(),
  heightCm: z.number().int().min(HEIGHT_MIN_CM).max(HEIGHT_MAX_CM).nullable(),
  jobTitle: z.string().trim().max(JOB_MAX_LENGTH, e('jobTooLong')),
  education: z.enum(enums.education_level).nullable(),
  languages: z
    .array(z.enum(enums.spoken_language))
    .max(MAX_LANGUAGES, e('tooManyLanguages'))
    .refine((l) => new Set(l).size === l.length),
  religion: z.enum(enums.religion).nullable(),
  smoking: z.enum(enums.habit_frequency).nullable(),
  drinking: z.enum(enums.habit_frequency).nullable(),
  pets: z.enum(enums.pets_status).nullable(),
  children: z.enum(enums.children_plan).nullable(),
})
export type AboutInput = z.infer<typeof aboutSchema>

export const EMPTY_ABOUT: AboutInput = {
  relationshipGoal: null,
  heightCm: null,
  jobTitle: '',
  education: null,
  languages: [],
  religion: null,
  smoking: null,
  drinking: null,
  pets: null,
  children: null,
}

export const promptSchema = z.object({
  key: z.enum(PROMPT_KEYS),
  answer: z
    .string()
    .trim()
    .min(1, e('promptAnswerRequired'))
    .max(PROMPT_MAX_LENGTH, e('promptAnswerTooLong')),
})
export type ProfilePrompt = z.infer<typeof promptSchema>

export const promptsSchema = z
  .array(promptSchema)
  .max(MAX_PROMPTS)
  .refine((p) => new Set(p.map((x) => x.key)).size === p.length, e('promptDuplicate'))

// Rows as stored (snake_case columns, nulls), as returned by selects and RPCs.
export type AboutRow = {
  relationship_goal: Enums<'relationship_goal'> | null
  height_cm: number | null
  job_title: string | null
  education: Enums<'education_level'> | null
  languages: Enums<'spoken_language'>[] | null
  religion: Enums<'religion'> | null
  smoking: Enums<'habit_frequency'> | null
  drinking: Enums<'habit_frequency'> | null
  pets: Enums<'pets_status'> | null
  children: Enums<'children_plan'> | null
}

export function aboutFromRow(r: AboutRow): AboutInput {
  return {
    relationshipGoal: r.relationship_goal ?? null,
    heightCm: r.height_cm ?? null,
    jobTitle: r.job_title ?? '',
    education: r.education ?? null,
    languages: r.languages ?? [],
    religion: r.religion ?? null,
    smoking: r.smoking ?? null,
    drinking: r.drinking ?? null,
    pets: r.pets ?? null,
    children: r.children ?? null,
  }
}

// Prompts from a jsonb column / RPC ([{ key, answer }]); unknown keys are dropped.
type PromptRow = { prompt_key: string; answer: string; position: number }
export function promptsFromRows(rows: PromptRow[]): ProfilePrompt[] {
  return parsePrompts(
    [...rows]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ key: r.prompt_key, answer: r.answer })),
  )
}

export function parsePrompts(raw: unknown): ProfilePrompt[] {
  const items = z.array(z.unknown()).catch([]).parse(raw)
  return items.flatMap((item) => {
    const p = promptSchema.safeParse(item)
    return p.success ? [p.data] : []
  })
}
