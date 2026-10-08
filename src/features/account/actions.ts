'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { localePath } from '@/i18n/config'
import { fail, zodErrorKey, type UserResult } from '@/i18n/errors'
import { getActionLocale } from '@/i18n/server'
import { getViewer } from '@/features/auth/session'
import { deleteAccountSchema, type DeleteAccountInput } from './schemas'
import { removeUserFiles } from './storage'

// Self-service account deletion (PDPA, app store rules). Deleting the auth user cascades to the
// profile and every public table that references it (see tests/sql "account deletion").
export async function deleteAccount(input: DeleteAccountInput): Promise<UserResult> {
  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) return fail(zodErrorKey(parsed.error))
  const viewer = await getViewer()
  if (!viewer) return fail('unauthorized')

  // Files first: once the user row is gone nothing points at them any more.
  if (!(await removeUserFiles(viewer.id))) return fail('accountDeleteFailed')

  const { error } = await createAdminClient().auth.admin.deleteUser(viewer.id)
  if (error) return fail('accountDeleteFailed')

  // Clears the session cookies (the server-side session died with the user).
  await (await createClient()).auth.signOut()
  redirect(localePath(await getActionLocale(), '/login'))
}
