'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { requireAdmin } from './guard'
import { deletePhotoSchema } from './schemas'

// Removes a profile photo: the row (and the audit entry) via the RPC first, so the photo
// disappears from the app even if the storage cleanup fails, then the file itself.
export async function deletePhoto(input: z.input<typeof deletePhotoSchema>): Promise<ActionResult> {
  const parsed = deletePhotoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Неверные данные' }
  }
  const adminId = await requireAdmin()
  const db = createAdminClient()

  const { data: path, error } = await db.rpc('admin_delete_photo', {
    p_admin: adminId,
    p_photo: parsed.data.photoId,
    p_reason: parsed.data.reason,
  })
  if (error) return { ok: false, error: `Ошибка: ${error.message}` }

  const { error: storageError } = await db.storage.from('profile-photos').remove([path])
  revalidatePath('/admin', 'layout')
  if (storageError) {
    return {
      ok: false,
      error: `Фото убрано из профиля, но файл не удалён: ${storageError.message}`,
    }
  }
  return { ok: true, data: undefined }
}
