import {
  BookOpen,
  Clapperboard,
  Coffee,
  Croissant,
  Dumbbell,
  Feather,
  Footprints,
  Gamepad2,
  MessagesSquare,
  MicVocal,
  Mountain,
  Music,
  Palette,
  Soup,
  Store,
  TreePalm,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { z } from 'zod'

// Preset plans only (no free text: nothing to moderate). Must match the CHECK on
// public.user_plans.tag (20261009000200_crossed_paths_plans.sql).
export const PLAN_TAGS = [
  'coffee',
  'football',
  'mamak',
  'morning-run',
  'gym',
  'movie',
  'karaoke',
  'hiking',
  'study',
  'new-cafe',
  'night-market',
  'badminton',
  'beach',
  'gaming',
  'concert',
  'art-gallery',
  'food-hunt',
  'chatting',
] as const

export type PlanTag = (typeof PLAN_TAGS)[number]

export const planTagSchema = z.enum(PLAN_TAGS)

export const PLAN_ICONS: Record<PlanTag, LucideIcon> = {
  coffee: Coffee,
  football: Trophy,
  mamak: UtensilsCrossed,
  'morning-run': Footprints,
  gym: Dumbbell,
  movie: Clapperboard,
  karaoke: MicVocal,
  hiking: Mountain,
  study: BookOpen,
  'new-cafe': Croissant,
  'night-market': Store,
  badminton: Feather,
  beach: TreePalm,
  gaming: Gamepad2,
  concert: Music,
  'art-gallery': Palette,
  'food-hunt': Soup,
  chatting: MessagesSquare,
}

export function asPlanTag(value: unknown): PlanTag | null {
  const parsed = planTagSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export type OwnPlan = { tag: PlanTag; expiresAt: string }
