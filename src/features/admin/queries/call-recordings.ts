import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/types/database.types'

// A call between the reported user and a reporter, as listed on the report card. The recording
// itself is opened separately (openCallRecording), which logs the access.
export type ReportCall = {
  id: string
  kind: Enums<'call_kind'>
  status: Enums<'call_status'>
  startedAt: string
  durationSec: number | null
  recording: Enums<'call_recording_status'>
}

// Calls between `offenderId` and any of `reporterIds`, newest first. Service role: callers must
// have authorized the moderator (getOpenReportGroups → requireAdmin).
export async function getCallsBetween(offenderId: string, reporterIds: string[]) {
  if (!reporterIds.length) return []
  const list = reporterIds.join(',')
  const { data } = await createAdminClient()
    .from('calls')
    .select('id, kind, status, started_at, answered_at, ended_at, recording_status')
    .or(
      `and(caller_id.eq.${offenderId},callee_id.in.(${list})),and(callee_id.eq.${offenderId},caller_id.in.(${list}))`,
    )
    .order('started_at', { ascending: false })
    .limit(20)
  return (data ?? []).map((c): ReportCall => ({
    id: c.id,
    kind: c.kind,
    status: c.status,
    startedAt: c.started_at,
    durationSec:
      c.answered_at && c.ended_at
        ? Math.round((Date.parse(c.ended_at) - Date.parse(c.answered_at)) / 1000)
        : null,
    recording: c.recording_status,
  }))
}
