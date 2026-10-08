import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasRole, type AdminRole } from './roles'

export type Admin = { id: string; role: AdminRole }

// The signed-in panel member, deduped per request; 404s for everyone else so the panel's
// existence isn't revealed.
export const getAdmin = cache(async (): Promise<Admin> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) notFound()

  const { data: admin } = await createAdminClient()
    .from('admins')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!admin) notFound()
  return { id: admin.user_id, role: admin.role }
})

// Returns the moderator's user id, or 404s. Every admin page and action calls this before
// touching the service-role client; `min` also 404s members below that role (the RPCs re-check).
export async function requireAdmin({ min = 'viewer' }: { min?: AdminRole } = {}): Promise<string> {
  const admin = await getAdmin()
  if (!hasRole(admin.role, min)) notFound()
  return admin.id
}

// For server actions: the member if they have at least `min`, otherwise null (no 404 inside an
// action, the caller returns a readable error instead).
export async function adminWithRole(min: AdminRole): Promise<Admin | null> {
  const admin = await getAdmin()
  return hasRole(admin.role, min) ? admin : null
}
