'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type UserResult } from '@/i18n/errors'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getDailyPrompt, getPromptMatches } from './queries'
import type { DailyPrompt, PromptMatch } from './types'

const uuid = z.uuid()
const option = z.number().int().min(0).max(3)

function promptError(code: string | undefined): ErrorKey {
  if (code === '42501') return 'unauthorized'
  if (code === 'P0002' || code === 'PGRST202') return 'conversationUnavailable'
  return 'generic'
}

export type AnsweredPrompt = { prompt: DailyPrompt; matches: PromptMatch[] }

// Records (or changes) the answer and returns the card's next state: counts plus the people who
// chose the same.
export async function answerDailyPrompt(
  promptId: string,
  optionIdx: number,
): Promise<UserResult<AnsweredPrompt>> {
  if (!uuid.safeParse(promptId).success || !option.safeParse(optionIdx).success) {
    return fail('invalidInput')
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('answer_daily_prompt', {
    p_prompt: promptId,
    p_option: optionIdx,
  })
  if (error) return fail(promptError(error.code))
  const [prompt, matches] = await Promise.all([getDailyPrompt(), getPromptMatches(promptId)])
  if (!prompt) return fail('conversationUnavailable')
  return ok({ prompt, matches })
}
