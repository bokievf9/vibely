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

// Status quick picks (preset tags, no free text). Must match the CHECK on
// public.user_statuses.plan_tag (20261009000271_live_statuses.sql). The 24-hour Plans that first
// used this list were removed in 20261009000280; Discover's "Similar statuses" sorts by it.
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
