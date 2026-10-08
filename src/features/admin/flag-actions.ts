'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { requireAdmin } from './guard'
import { keywordSchema } from './report-schemas'

// Keyword list of the server-side auto-flagging (20261009000163). Changes are logged.
export async function addRiskKeyword(input: z.input<typeof keywordSchema>): Promise<ActionResult> {
  const parsed = keywordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Неверные данные' }
  }
  const adminId = await requireAdmin()
  const { error } = await createAdminClient().rpc('admin_add_risk_keyword', {
    p_admin: adminId,
    p_keyword: parsed.data.keyword,
    p_weight: parsed.data.weight,
  })
  if (error) return { ok: false, error: `Ошибка: ${error.message}` }
  revalidatePath('/admin/reports/flagged')
  return { ok: true, data: undefined }
}

export async function removeRiskKeyword(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Неверные данные' }
  const adminId = await requireAdmin()
  const { error } = await createAdminClient().rpc('admin_remove_risk_keyword', {
    p_admin: adminId,
    p_id: parsed.data.id,
  })
  if (error) return { ok: false, error: `Ошибка: ${error.message}` }
  revalidatePath('/admin/reports/flagged')
  return { ok: true, data: undefined }
}
