import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPurgeSecret } from '@/features/calls/server/env'
import { deleteRecordings } from '@/features/calls/server/recordings'

// Daily retention job (docs/calls.md): deletes call recordings older than 90 days that are not
// evidence in an open report, then clears their rows. Called by cron with
//   Authorization: Bearer $CALLS_PURGE_SECRET
// Without the secret configured the route does not exist (404). Excluded from src/proxy.ts.
export async function POST(request: Request) {
  const secret = getPurgeSecret()
  if (!secret) return new Response(null, { status: 404 })
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response(null, { status: 401 })
  }

  const db = createAdminClient()
  const { data: due, error } = await db.rpc('call_recordings_to_purge', { p_limit: 500 })
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  const deleted = new Set(await deleteRecordings(due.map((d) => d.recording_path)))
  const ids = due.filter((d) => deleted.has(d.recording_path)).map((d) => d.call_id)
  const { data: marked } = ids.length
    ? await db.rpc('mark_call_recordings_purged', { p_ids: ids })
    : { data: 0 }
  const { data: rows } = await db.rpc('purge_old_calls')
  return Response.json(
    { ok: true, due: due.length, deleted: marked ?? 0, rowsDeleted: rows ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
