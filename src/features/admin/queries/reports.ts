import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/types/database.types'
import { requireAdmin } from '../guard'
import { getReportContexts, type ReportContext } from './report-context'

export type ReportTarget = Enums<'report_target'>

export type ReportGroup = {
  targetType: ReportTarget
  targetId: string
  reasons: { reporterName: string; reporterId: string; reason: string; createdAt: string }[]
  firstReportedAt: string
  context: ReportContext | null
}

// Open reports grouped per target: one decision closes every report on the same thing.
// Most-reported targets first.
export async function getOpenReportGroups(limit = 200): Promise<ReportGroup[]> {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('reports')
    .select('target_type, target_id, reason, created_at, reporter_id, profiles(display_name)')
    .is('resolved_at', null)
    .order('created_at')
    .limit(limit)
  if (!data?.length) return []

  const groups = new Map<string, ReportGroup>()
  for (const r of data) {
    const key = `${r.target_type}:${r.target_id}`
    const group = groups.get(key) ?? {
      targetType: r.target_type,
      targetId: r.target_id,
      reasons: [],
      firstReportedAt: r.created_at,
      context: null,
    }
    group.reasons.push({
      reporterName: r.profiles?.display_name ?? '—',
      reporterId: r.reporter_id,
      reason: r.reason,
      createdAt: r.created_at,
    })
    groups.set(key, group)
  }

  const list = [...groups.values()]
  const contexts = await getReportContexts(list)
  return list
    .map((g) => ({ ...g, context: contexts.get(`${g.targetType}:${g.targetId}`) ?? null }))
    .sort((a, b) => b.reasons.length - a.reasons.length)
}
