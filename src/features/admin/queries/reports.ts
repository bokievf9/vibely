import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/types/database.types'
import { requireAdmin } from '../guard'
import type { CaseStatus } from '../report-labels'
import { getReportContexts, type ReportContext } from './report-context'

export type ReportTarget = Enums<'report_target'>

export type CaseReport = {
  reporterName: string
  reporterId: string
  reason: string
  createdAt: string
}

// A case: every open report on one target. One decision closes them all.
export type ReportCase = {
  targetType: ReportTarget
  targetId: string
  subjectId: string | null
  reasons: CaseReport[]
  reasonCodes: string[]
  tier: number
  priority: number
  firstReportedAt: string
  ageMinutes: number
  status: CaseStatus
  claimedBy: { id: string; name: string; me: boolean } | null
  claimedAt: string | null
  context: ReportContext | null
}

// Kept for older imports.
export type ReportGroup = ReportCase

export const QUEUE_PAGE_SIZE = 20

export type QueueFilters = {
  status: CaseStatus | 'mine' | null
  reason: string | null
  targetType: ReportTarget | null
  page: number
}

// Moderators may have no dating profile, so names are best-effort.
export async function adminNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map()
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, display_name')
    .in('id', unique)
  return new Map(data?.map((p) => [p.id, p.display_name]))
}

// The queue (admin_report_queue): highest priority first (reason tier, then reporters), oldest
// first within a priority. Expired claims (30 min) count as open again.
export async function getReportQueue(
  filters: QueueFilters,
): Promise<{ cases: ReportCase[]; total: number }> {
  const adminId = await requireAdmin()
  const db = createAdminClient()
  const { data, error } = await db.rpc('admin_report_queue', {
    p_admin: adminId,
    p_status: filters.status === 'mine' ? 'in_review' : (filters.status ?? undefined),
    p_reason: filters.reason ?? undefined,
    p_target_type: filters.targetType ?? undefined,
    p_mine: filters.status === 'mine',
    p_limit: QUEUE_PAGE_SIZE,
    p_offset: (filters.page - 1) * QUEUE_PAGE_SIZE,
  })
  if (error) throw new Error(`report queue: ${error.message}`)
  if (!data?.length) return { cases: [], total: 0 }

  // The individual reports of the cases on this page.
  const byType = new Map<ReportTarget, string[]>()
  for (const c of data)
    byType.set(c.target_type, [...(byType.get(c.target_type) ?? []), c.target_id])
  const reportRows = await Promise.all(
    [...byType].map(([type, ids]) =>
      db
        .from('reports')
        .select(
          'target_type, target_id, reason, created_at, reporter_id, profiles!reports_reporter_id_fkey(display_name)',
        )
        .is('resolved_at', null)
        .eq('target_type', type)
        .in('target_id', ids)
        .order('created_at'),
    ),
  )
  const reports = new Map<string, CaseReport[]>()
  for (const { data: rows } of reportRows) {
    for (const r of rows ?? []) {
      const key = `${r.target_type}:${r.target_id}`
      reports.set(key, [
        ...(reports.get(key) ?? []),
        {
          reporterName: r.profiles?.display_name ?? '—',
          reporterId: r.reporter_id,
          reason: r.reason,
          createdAt: r.created_at,
        },
      ])
    }
  }

  const names = await adminNames(data.flatMap((c) => (c.claimed_by ? [c.claimed_by] : [])))
  const now = Date.now()
  const cases = data.map((c): ReportCase => ({
    targetType: c.target_type,
    targetId: c.target_id,
    subjectId: c.subject_id,
    reasons: reports.get(`${c.target_type}:${c.target_id}`) ?? [],
    reasonCodes: c.reasons ?? [],
    tier: c.tier,
    priority: c.priority,
    firstReportedAt: c.first_reported_at,
    ageMinutes: Math.round((now - Date.parse(c.first_reported_at)) / 60_000),
    status: c.status === 'in_review' ? 'in_review' : 'open',
    claimedBy: c.claimed_by
      ? {
          id: c.claimed_by,
          name: names.get(c.claimed_by) ?? c.claimed_by.slice(0, 8),
          me: c.claimed_by === adminId,
        }
      : null,
    claimedAt: c.claimed_at,
    context: null,
  }))
  const contexts = await getReportContexts(cases)
  return {
    cases: cases.map((c) => ({
      ...c,
      context: contexts.get(`${c.targetType}:${c.targetId}`) ?? null,
    })),
    total: Number(data[0]?.total ?? 0),
  }
}

export type HistoryEntry = {
  targetType: ReportTarget
  targetId: string
  subjectId: string | null
  subjectName: string | null
  reportCount: number
  reasonCodes: string[]
  firstReportedAt: string
  resolvedAt: string
  resolvedBy: string
  decision: string | null
  resolution: string | null
}

// Resolution history: one row per decision, newest first.
export async function getReportHistory(filters: {
  reason: string | null
  targetType: ReportTarget | null
  page: number
}): Promise<{ entries: HistoryEntry[]; total: number }> {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_report_history', {
    p_admin: adminId,
    p_target_type: filters.targetType ?? undefined,
    p_reason: filters.reason ?? undefined,
    p_limit: QUEUE_PAGE_SIZE,
    p_offset: (filters.page - 1) * QUEUE_PAGE_SIZE,
  })
  if (error) throw new Error(`report history: ${error.message}`)
  if (!data?.length) return { entries: [], total: 0 }

  const names = await adminNames(
    data.flatMap((h) => [h.resolved_by, h.subject_id].filter((id): id is string => !!id)),
  )
  return {
    entries: data.map((h) => ({
      targetType: h.target_type,
      targetId: h.target_id,
      subjectId: h.subject_id,
      subjectName: h.subject_id ? (names.get(h.subject_id) ?? null) : null,
      reportCount: h.report_count,
      reasonCodes: h.reasons ?? [],
      firstReportedAt: h.first_reported_at,
      resolvedAt: h.resolved_at,
      resolvedBy: h.resolved_by
        ? (names.get(h.resolved_by) ?? h.resolved_by.slice(0, 8))
        : 'удалён',
      decision: h.decision,
      resolution: h.resolution,
    })),
    total: Number(data[0]?.total ?? 0),
  }
}
