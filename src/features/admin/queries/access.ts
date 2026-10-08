import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdmin } from '../guard'

type AccessAction = 'view.selfie' | 'view.transcript'

// CLAUDE.md: every moderator access to private material is logged in moderation_actions. Call it
// right before the material is shown; when it returns false (no right to see it, or the log could
// not be written) the caller must not show the material.
export async function logAccess(
  action: AccessAction,
  targetType: string,
  targets: string[],
  reason?: string,
): Promise<boolean> {
  if (!targets.length) return true
  const admin = await getAdmin()
  const { error } = await createAdminClient().rpc('admin_log_access', {
    p_admin: admin.id,
    p_action: action,
    p_type: targetType,
    p_targets: targets,
    p_reason: reason,
  })
  if (error) console.warn('[admin] access log refused', action, error.message)
  return !error
}
