import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '../guard'
import { parseHeldDuoBios, type HeldDuoBio } from '../group-evidence'

// Duo bios held by the risk detector (admin_held_duo_bios, viewer and up), oldest first.
// `available: false` until 20261009000261 is applied (PGRST202), so the page does not crash.
export async function getHeldDuoBios(): Promise<{ available: boolean; bios: HeldDuoBio[] }> {
  const adminId = await requireAdmin()
  const { data, error } = await createAdminClient().rpc('admin_held_duo_bios', {
    p_admin: adminId,
    p_limit: 100,
  })
  if (error) {
    if (error.code !== 'PGRST202') console.error('[admin] held duo bios', error.message)
    return { available: false, bios: [] }
  }
  return { available: true, bios: parseHeldDuoBios(data) }
}
