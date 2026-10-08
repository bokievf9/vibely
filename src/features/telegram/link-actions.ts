'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/features/admin/guard'
import type { ActionResult } from '@/types/action-result'
import { LINK_CODE_ALPHABET } from './protocol'

// A new one-time code for `/link CODE` (10 minutes). Only its hash is stored; the plain code is
// returned once, to this moderator's browser.
export async function issueTelegramLinkCode(): Promise<
  ActionResult<{ code: string; expiresAt: string }>
> {
  const adminId = await requireAdmin()
  const code = Array.from(
    { length: 8 },
    () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)],
  ).join('')
  const { data, error } = await createAdminClient().rpc('admin_telegram_issue_code', {
    p_admin: adminId,
    p_code: code,
  })
  if (error || !data) return { ok: false, error: 'Не удалось создать код, попробуйте ещё раз' }
  return { ok: true, data: { code, expiresAt: data } }
}

export async function unlinkTelegram(): Promise<ActionResult> {
  const adminId = await requireAdmin()
  const { error } = await createAdminClient().rpc('admin_telegram_unlink', { p_admin: adminId })
  if (error) return { ok: false, error: 'Не удалось отвязать, попробуйте ещё раз' }
  revalidatePath('/admin/telegram')
  return { ok: true, data: undefined }
}
