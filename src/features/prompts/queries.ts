import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { signPhotoPaths } from '@/features/profile/queries'
import type { DailyPrompt, PromptMatch } from './types'

const localeRecord = z.object({ en: z.string(), ms: z.string(), ru: z.string() })
const localeLists = z.object({
  en: z.array(z.string()),
  ms: z.array(z.string()),
  ru: z.array(z.string()),
})

const promptSchema = z.object({
  id: z.uuid(),
  question: localeRecord,
  options: localeLists,
  my_option: z.number().int().nullable(),
  counts: z.array(z.number().int()).nullable(),
  ends_at: z.string(),
})

const matchSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  age: z.number().int(),
  photo: z
    .object({ path: z.string(), width: z.number(), height: z.number() })
    .nullable()
    .catch(null),
})

// Today's question for the feed card, or null: no active question, the viewer is not verified,
// or the migration is not applied yet (the card is simply not shown).
export async function getDailyPrompt(): Promise<DailyPrompt | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_daily_prompt')
  if (error || !data) return null
  const parsed = promptSchema.safeParse(data)
  if (!parsed.success) return null
  const p = parsed.data
  return {
    id: p.id,
    question: p.question,
    options: p.options,
    myOption: p.my_option,
    counts: p.counts,
    endsAt: p.ends_at,
  }
}

// Up to 8 people who chose the same answer (empty before the viewer answered). Photos are signed
// with the viewer's own client, like Discover cards.
export async function getPromptMatches(promptId: string): Promise<PromptMatch[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_prompt_matches', { p_prompt: promptId })
  if (error || !data) return []
  const rows = data.flatMap((r) => {
    const m = matchSchema.safeParse(r)
    return m.success ? [m.data] : []
  })
  const urls = await signPhotoPaths([
    ...new Set(rows.flatMap((r) => (r.photo ? [r.photo.path] : []))),
  ])
  return rows.map((r) => {
    const url = r.photo && urls.get(r.photo.path)
    return {
      id: r.id,
      name: r.display_name,
      age: r.age,
      photo: r.photo && url ? { url, width: r.photo.width, height: r.photo.height } : null,
    }
  })
}
