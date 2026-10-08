// Interest categories in display order. Must match the `tags_category_check` constraint
// (supabase/migrations/20261008000050_tags_catalog.sql).
export const TAG_CATEGORIES = [
  'sports',
  'outdoors',
  'food',
  'music',
  'screen',
  'creative',
  'games',
  'lifestyle',
  'learning',
  'nature',
] as const

export type TagCategory = (typeof TAG_CATEGORIES)[number]

export function isTagCategory(value: string): value is TagCategory {
  return (TAG_CATEGORIES as readonly string[]).includes(value)
}
