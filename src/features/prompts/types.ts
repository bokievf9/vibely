import type { Locale } from '@/i18n/config'

// The question of the day as the feed card shows it (get_daily_prompt, 20261009000220).
// counts is only present once the viewer answered.
export type DailyPrompt = {
  id: string
  question: Record<Locale, string>
  options: Record<Locale, string[]>
  myOption: number | null
  counts: number[] | null
  // When the next question replaces this one (19:00 Asia/Kuala_Lumpur).
  endsAt: string
}

// Someone who chose the same answer and whom the viewer could meet in Discover. Name, age and
// main photo only: the same as a Discover card (get_prompt_matches).
export type PromptMatch = {
  id: string
  name: string
  age: number
  photo: { url: string; width: number; height: number } | null
}
