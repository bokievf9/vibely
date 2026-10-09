import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'

export type AdminPrompt = {
  id: string
  sortOrder: number
  question: { en: string; ms: string; ru: string }
  options: { en: string[]; ms: string[]; ru: string[] }
  // Set once the question was shown (its "prompt day"); null while queued.
  showDate: string | null
  pushedAt: string | null
  createdAt: string
  // Answers per option (shown questions only).
  counts: number[]
}

export type PromptQueue = { queued: AdminPrompt[]; shown: AdminPrompt[]; available: boolean }

const RECENT_SHOWN = 14

// The queue (next first) and the last shown questions with their answer counts. `available` is
// false until 20261009000220 is applied (the page then explains instead of crashing).
export async function getPromptQueue(): Promise<PromptQueue> {
  await requireAdmin()
  const db = createAdminClient()
  const { data, error } = await db
    .from('daily_prompts')
    .select(
      'id, sort_order, question_en, question_ms, question_ru, options_en, options_ms, options_ru, show_date, pushed_at, created_at',
    )
    .order('sort_order')
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return { queued: [], shown: [], available: false }
    }
    throw new Error(`daily prompts: ${error.message}`)
  }
  const rows = (data ?? []).map((r): AdminPrompt => ({
    id: r.id,
    sortOrder: r.sort_order,
    question: { en: r.question_en, ms: r.question_ms, ru: r.question_ru },
    options: { en: r.options_en, ms: r.options_ms, ru: r.options_ru },
    showDate: r.show_date,
    pushedAt: r.pushed_at,
    createdAt: r.created_at,
    counts: r.options_en.map(() => 0),
  }))
  const queued = rows.filter((r) => r.showDate === null)
  const shown = rows
    .filter((r) => r.showDate !== null)
    .sort((a, b) => (a.showDate! < b.showDate! ? 1 : -1))
    .slice(0, RECENT_SHOWN)
  if (shown.length) {
    const { data: answers } = await db
      .from('prompt_answers')
      .select('prompt_id, option_idx')
      .in(
        'prompt_id',
        shown.map((p) => p.id),
      )
    const byId = new Map(shown.map((p) => [p.id, p]))
    for (const a of answers ?? []) {
      const p = byId.get(a.prompt_id)
      if (p && a.option_idx < p.counts.length)
        p.counts[a.option_idx] = (p.counts[a.option_idx] ?? 0) + 1
    }
  }
  return { queued, shown, available: true }
}
