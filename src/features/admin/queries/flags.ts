import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import type { FlagKind } from '../report-labels'

export type FlaggedUser = {
  id: string
  name: string
  username: string
  score: number
  flags: number
  conversations: number
  kinds: Partial<Record<FlagKind, number>>
  lastFlagAt: string
  banned: boolean
  openReports: number
}

export const FLAGGED_PAGE_SIZE = 30

// Users whose rolling 14-day risk score is at or above the threshold (20261009000163). Only
// counts and kinds: the messages themselves stay behind an open report.
export async function getFlaggedUsers(page: number) {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_flagged_users', {
    p_admin: adminId,
    p_limit: FLAGGED_PAGE_SIZE,
    p_offset: (page - 1) * FLAGGED_PAGE_SIZE,
  })
  if (error) throw new Error(`flagged users: ${error.message}`)
  return {
    total: Number(data?.[0]?.total ?? 0),
    users: (data ?? []).map((u): FlaggedUser => ({
      id: u.user_id,
      name: u.display_name,
      username: u.username,
      score: u.score,
      flags: u.flags,
      conversations: u.conversations,
      kinds:
        u.kinds && typeof u.kinds === 'object' && !Array.isArray(u.kinds)
          ? (u.kinds as Partial<Record<FlagKind, number>>)
          : {},
      lastFlagAt: u.last_flag_at,
      banned: u.banned,
      openReports: u.open_reports,
    })),
  }
}

export type RiskKeyword = { id: string; keyword: string; weight: number; createdAt: string }

export async function getRiskKeywords(): Promise<RiskKeyword[]> {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('risk_keywords')
    .select('id, keyword, weight, created_at')
    .order('keyword')
  return (data ?? []).map((k) => ({
    id: k.id,
    keyword: k.keyword,
    weight: k.weight,
    createdAt: k.created_at,
  }))
}
