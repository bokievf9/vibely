import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { TARGET_LABELS } from '@/features/admin/labels'
import { adminUrl } from './client'
import type { ReportTargetType } from './protocol'

type Stats = {
  pending_selfies: number
  oldest_selfie_at: string | null
  open_reports: number
  open_report_targets: number
  oldest_report_at: string | null
  selfies_submitted: number
  selfies_approved: number
  selfies_rejected: number
  reports_created: number
  reports_resolved: number
  bans: number
  unbans: number
  auto_hidden: number
}

const KL_OFFSET_MS = 8 * 3600_000 // Asia/Kuala_Lumpur, no daylight saving

// Midnight today in Kuala Lumpur, as a UTC instant.
export function startOfKlDay(now = Date.now()): Date {
  const day = 24 * 3600_000
  return new Date(Math.floor((now + KL_OFFSET_MS) / day) * day - KL_OFFSET_MS)
}

export function waited(since: string | null, now = Date.now()): string {
  if (!since) return ''
  const mins = Math.max(0, Math.round((now - new Date(since).getTime()) / 60_000))
  if (mins < 60) return `${mins} мин`
  const hours = Math.floor(mins / 60)
  return hours < 48 ? `${hours} ч` : `${Math.floor(hours / 24)} дн`
}

async function loadStats(since: Date): Promise<Stats | null> {
  const { data, error } = await createAdminClient().rpc('telegram_stats', {
    p_since: since.toISOString(),
  })
  if (error) {
    console.error('[telegram] stats failed:', error.code)
    return null
  }
  return data as unknown as Stats
}

const queueLines = (s: Stats) => [
  `Селфи в очереди: ${s.pending_selfies}${s.oldest_selfie_at ? ` (старейшее ждёт ${waited(s.oldest_selfie_at)})` : ''}`,
  `Открытые жалобы: ${s.open_reports} на ${s.open_report_targets} объектов${s.oldest_report_at ? ` (старейшая ждёт ${waited(s.oldest_report_at)})` : ''}`,
]

const activityLines = (s: Stats) => [
  `Селфи: отправлено ${s.selfies_submitted}, одобрено ${s.selfies_approved}, отклонено ${s.selfies_rejected}`,
  `Жалобы: новых ${s.reports_created}, закрыто ${s.reports_resolved}`,
  `Баны: ${s.bans}, разбаны: ${s.unbans}, автоскрытий: ${s.auto_hidden}`,
]

export async function statsText(): Promise<string> {
  const s = await loadStats(startOfKlDay())
  if (!s) return 'Не удалось получить статистику.'
  return [
    '📊 Очередь',
    ...queueLines(s),
    '',
    'Сегодня (с 00:00 по Куала-Лумпуру)',
    ...activityLines(s),
  ].join('\n')
}

export async function digestText(): Promise<string | null> {
  const s = await loadStats(new Date(Date.now() - 24 * 3600_000))
  if (!s) return null
  return [
    '☀️ Сводка модерации за 24 часа',
    ...activityLines(s),
    '',
    ...queueLines(s),
    adminUrl('/admin'),
  ].join('\n')
}

export async function queueText(): Promise<string> {
  const db = createAdminClient()
  const [selfies, reports] = await Promise.all([
    db
      .from('verification_requests')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at')
      .limit(5),
    db
      .from('reports')
      .select('target_type, target_id, reason, created_at')
      .is('resolved_at', null)
      .order('created_at')
      .limit(200),
  ])
  const lines = ['🗂 Самые старые в очереди', '', `Селфи (${adminUrl('/admin/verification')}):`]
  if (!selfies.data?.length) lines.push('  пусто')
  for (const r of selfies.data ?? []) lines.push(`  • ждёт ${waited(r.created_at)}`)

  const groups = new Map<
    string,
    { t: ReportTargetType; id: string; n: number; at: string; reason: string }
  >()
  for (const r of reports.data ?? []) {
    const key = `${r.target_type}:${r.target_id}`
    const g = groups.get(key)
    if (g) g.n++
    else
      groups.set(key, {
        t: r.target_type,
        id: r.target_id,
        n: 1,
        at: r.created_at,
        reason: r.reason.split(':')[0]?.trim() ?? '',
      })
  }
  lines.push('', `Жалобы (${adminUrl('/admin/reports')}):`)
  if (!groups.size) lines.push('  пусто')
  for (const g of [...groups.values()].slice(0, 5)) {
    const link = g.t === 'user' ? ` ${adminUrl(`/admin/users/${g.id}`)}` : ''
    lines.push(
      `  • ${TARGET_LABELS[g.t]}, ${g.reason.slice(0, 24)}, жалоб: ${g.n}, ждёт ${waited(g.at)}${link}`,
    )
  }
  return lines.join('\n')
}
