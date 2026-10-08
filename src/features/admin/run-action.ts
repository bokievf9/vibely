import 'server-only'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import type { ActionResult } from '@/types/action-result'
import { adminWithRole, type Admin } from './guard'
import { ROLE_LABELS, type AdminRole } from './roles'

type DbError = { message: string; code?: string } | null

// Russian message for an RPC error. 42501 is what assert_admin_role raises.
export function adminRpcError(error: { message: string; code?: string }): string {
  if (error.code === '42501') return 'Недостаточно прав для этого действия'
  if (error.code === 'P0002') return 'Не найдено'
  return `Ошибка: ${error.message}`
}

// Validates, checks the role (the RPC re-checks it), runs and refreshes the panel. Used by the
// batch-4 admin actions (sanctions, team, appeals, notes, blocklist, exports).
export async function runAdminAction<S extends z.ZodType, T = void>(
  schema: S,
  input: unknown,
  min: AdminRole,
  run: (data: z.output<S>, admin: Admin) => Promise<{ error: DbError; data?: T }>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Неверные данные' }
  }
  const admin = await adminWithRole(min)
  if (!admin) return { ok: false, error: `Нужна роль «${ROLE_LABELS[min]}» или выше` }
  const { error, data } = await run(parsed.data, admin)
  if (error) return { ok: false, error: adminRpcError(error) }
  revalidatePath('/admin', 'layout')
  return { ok: true, data: data as T }
}
