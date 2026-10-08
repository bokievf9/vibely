import 'server-only'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { readableBan } from '@/features/admin/labels'
import type { ResolveInput } from '@/features/admin/schemas'
import { resolveSchema } from '@/features/admin/schemas'
import { hasRole, type AdminRole } from '@/features/admin/roles'
import type { TgUser } from './protocol'

// Moderation from Telegram runs the same RPCs as the admin panel, with the id of the moderator
// linked to the Telegram account (admins.telegram_user_id). Each RPC re-checks the moderator
// (assert_admin) and logs the decision in moderation_actions.

export type LinkedAdmin = { adminId: string; name: string }

export async function findLinkedAdmin(telegramUserId: number): Promise<LinkedAdmin | null> {
  const db = createAdminClient()
  const { data } = await db
    .from('admins')
    .select('user_id')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()
  if (!data) return null
  return { adminId: data.user_id, name: await moderatorName(data.user_id) }
}

export async function moderatorName(adminId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from('profiles')
    .select('display_name, username')
    .eq('id', adminId)
    .maybeSingle()
  return data ? `${data.display_name} (@${data.username})` : 'Модератор'
}

// How a Telegram user is named in "decided by" lines: the moderator's profile, plus the
// Telegram handle when there is one.
export const deciderLabel = (admin: LinkedAdmin, from?: TgUser) =>
  from?.username ? `${admin.name}, tg @${from.username}` : admin.name

// Refused or suspicious bot access (unknown users, unlinked users, link attempts). No message
// text is stored, only the event and a short detail.
export async function logRefusal(
  telegramUserId: number | null,
  chatId: number | null,
  event: string,
  detail?: string,
) {
  const { error } = await createAdminClient()
    .from('telegram_audit')
    .insert({
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      event: event.slice(0, 64),
      detail: detail?.slice(0, 200) ?? null,
    })
  if (error) console.error('[telegram] audit insert failed:', error.code)
  console.warn(`[telegram] refused: ${event}`)
}

export async function logModeration(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  reason?: string,
) {
  const { error } = await createAdminClient().rpc('log_moderation', {
    p_admin: adminId,
    p_action: action,
    p_type: targetType,
    p_target: targetId,
    p_reason: reason ?? '',
  })
  if (error) console.error('[telegram] log_moderation failed:', error.code)
}

const refresh = () => {
  try {
    revalidatePath('/admin', 'layout')
  } catch {
    // Outside a request (tests, timers): nothing to refresh.
  }
}

export type Outcome =
  | { ok: true }
  // Somebody else was faster, or the subject is gone.
  | { ok: false; already: true; message: string }
  | { ok: false; already: false; message: string }

const STATUS_LABELS: Record<string, string> = {
  approved: 'уже одобрено',
  rejected: 'уже отклонено',
  pending: 'на проверке',
}

export async function reviewSelfieAs(
  adminId: string,
  requestId: string,
  approve: boolean,
  reason?: string,
): Promise<Outcome & { userId?: string }> {
  const db = createAdminClient()
  const { error } = await db.rpc('admin_review_verification', {
    p_admin: adminId,
    p_request: requestId,
    p_approve: approve,
    p_reason: approve ? undefined : reason,
  })
  const { data: req } = await db
    .from('verification_requests')
    .select('user_id, status, reviewer_id')
    .eq('id', requestId)
    .maybeSingle()
  if (error) {
    // admin_review_verification raises 'Request is not pending' (P0002) for the second click.
    if (req && req.status !== 'pending') {
      const by = req.reviewer_id ? await moderatorName(req.reviewer_id) : 'другой модератор'
      return { ok: false, already: true, message: `Заявка ${STATUS_LABELS[req.status]}: ${by}` }
    }
    if (!req) return { ok: false, already: true, message: 'Заявка не найдена (аккаунт удалён?)' }
    console.error('[telegram] review failed:', error.code)
    return { ok: false, already: false, message: 'Не получилось, попробуйте в админке' }
  }
  refresh()
  return { ok: true, userId: req?.user_id }
}

export async function setBanAs(
  adminId: string,
  userId: string,
  banned: boolean,
  reason?: string,
): Promise<Outcome> {
  const db = createAdminClient()
  const { data: p } = await db.from('profiles').select('banned_at').eq('id', userId).maybeSingle()
  if (!p) return { ok: false, already: true, message: 'Пользователь не найден' }
  if (banned === Boolean(p.banned_at)) {
    return {
      ok: false,
      already: true,
      message: banned ? 'Уже заблокирован' : 'Не заблокирован',
    }
  }
  const { error } = banned
    ? await banAs(adminId, userId, reason)
    : await db.rpc('admin_set_ban', { p_admin: adminId, p_user: userId, p_banned: false })
  if (error) {
    console.error('[telegram] ban failed:', error.code)
    return failure(error.code)
  }
  refresh()
  return { ok: true }
}

// Bans from Telegram follow the panel's role rules (20261009000151): admins and owners ban
// permanently, moderators can ban for at most 7 days. Unbans need admin; the RPC enforces it.
const MODERATOR_BAN_DAYS = 7

async function banAs(adminId: string, userId: string, reason: string | undefined) {
  const db = createAdminClient()
  const { data } = await db.from('admins').select('role').eq('user_id', adminId).maybeSingle()
  const role = (data?.role ?? 'viewer') as AdminRole
  if (hasRole(role, 'admin')) {
    return db.rpc('admin_set_ban', {
      p_admin: adminId,
      p_user: userId,
      p_banned: true,
      p_reason: reason,
    })
  }
  return db.rpc('admin_ban_user', {
    p_admin: adminId,
    p_user: userId,
    p_reason: reason ?? 'other',
    p_days: MODERATOR_BAN_DAYS,
  })
}

const failure = (code: string | undefined): Outcome => ({
  ok: false,
  already: false,
  message:
    code === '42501'
      ? 'Недостаточно прав для этого действия'
      : 'Не получилось, попробуйте в админке',
})

// Open reports on one target (0: someone already resolved them).
export async function openReportCount(
  targetType: ResolveInput['targetType'],
  targetId: string,
): Promise<number> {
  const { count } = await createAdminClient()
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .is('resolved_at', null)
  return count ?? 0
}

// One decision on a report group, same semantics as resolveReports() in
// src/features/admin/actions.ts. This is the single place to switch to the atomic resolve RPC
// (admin reports branch, migrations 160-169) once it lands: replace the body below with one
// rpc() call and map its "already resolved" result to { already: true }.
export async function resolveReportGroupAs(adminId: string, input: ResolveInput): Promise<Outcome> {
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, already: false, message: 'Неверные данные' }
  const d = parsed.data
  if ((await openReportCount(d.targetType, d.targetId)) === 0) {
    return { ok: false, already: true, message: 'Жалобы уже обработаны' }
  }

  const db = createAdminClient()
  const resolve = (resolution: string) =>
    db.rpc('admin_resolve_reports', {
      p_admin: adminId,
      p_type: d.targetType,
      p_target: d.targetId,
      p_resolution: resolution,
    })
  const steps: (() => PromiseLike<{ error: { code?: string } | null }>)[] = []
  switch (d.decision) {
    case 'dismiss':
      steps.push(() => resolve(d.reason || 'Отклонено: нарушения нет'))
      break
    case 'hide':
      steps.push(
        () =>
          db.rpc('admin_set_content_hidden', {
            p_admin: adminId,
            p_type: d.targetType,
            p_id: d.targetId,
            p_hidden: true,
            p_reason: d.reason,
          }),
        () => resolve(`Контент скрыт: ${d.reason}`),
      )
      break
    case 'ban':
      steps.push(
        () => banAs(adminId, d.offenderId, d.reason),
        () => resolve(`Пользователь заблокирован: ${readableBan(d.reason)}`),
      )
      break
  }
  for (const step of steps) {
    const { error } = await step()
    if (error) {
      console.error('[telegram] resolve failed:', error.code)
      return failure(error.code)
    }
  }
  refresh()
  return { ok: true }
}
