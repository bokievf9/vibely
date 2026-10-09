import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { asPlanTag, type OwnPlan, type PlanTag } from './tags'

// The caller's active plan. `undefined` when plans are not available yet (the migration
// 20261009000200 is not applied): callers then hide the plan UI entirely.
export async function getOwnPlan(userId: string): Promise<OwnPlan | null | undefined> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_plans')
    .select('tag, expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) return undefined
  const tag = asPlanTag(data?.tag)
  return data && tag ? { tag, expiresAt: data.expires_at } : null
}

// Active plans of other people. RLS returns only visible profiles (verified, not blocked) and
// active plans; on any error (e.g. table missing) there are simply no badges.
export async function getPlansFor(userIds: string[]): Promise<Map<string, PlanTag>> {
  if (!userIds.length) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_plans')
    .select('user_id, tag')
    .in('user_id', userIds)
    .gt('expires_at', new Date().toISOString())
  if (error || !data) return new Map()
  return new Map(
    data.flatMap((row) => {
      const tag = asPlanTag(row.tag)
      return tag ? [[row.user_id, tag] as const] : []
    }),
  )
}
