'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/action-result'
import { adminWithRole } from './guard'
import { bulkDeletePhotosSchema, photoIdsSchema } from './report-schemas'

// Pending photo review (/admin/photos). Each photo is logged on its own by the RPCs
// (photo.approve / photo.delete).
export async function approvePhotos(
  input: z.input<typeof photoIdsSchema>,
): Promise<ActionResult<{ approved: number }>> {
  const parsed = photoIdsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Неверные данные' }
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return { ok: false, error: 'Нужна роль «Модератор» или выше' }
  const { data, error } = await createAdminClient().rpc('admin_approve_photos', {
    p_admin: adminId,
    p_photos: parsed.data.photoIds,
  })
  if (error) return { ok: false, error: `Ошибка: ${error.message}` }
  revalidatePath('/admin/photos')
  return { ok: true, data: { approved: data } }
}

// Rows first (the photos disappear from the app even if the storage cleanup fails), then files.
export async function deletePhotos(
  input: z.input<typeof bulkDeletePhotosSchema>,
): Promise<ActionResult<{ deleted: number }>> {
  const parsed = bulkDeletePhotosSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Неверные данные' }
  }
  const adminId = (await adminWithRole('moderator'))?.id
  if (!adminId) return { ok: false, error: 'Нужна роль «Модератор» или выше' }
  const db = createAdminClient()
  const { data: paths, error } = await db.rpc('admin_delete_photos', {
    p_admin: adminId,
    p_photos: parsed.data.photoIds,
    p_reason: parsed.data.reason,
  })
  if (error) return { ok: false, error: `Ошибка: ${error.message}` }
  revalidatePath('/admin', 'layout')
  if (paths?.length) {
    const { error: storageError } = await db.storage.from('profile-photos').remove(paths)
    if (storageError) {
      return {
        ok: false,
        error: `Фото убраны из профилей, но файлы не удалены: ${storageError.message}`,
      }
    }
  }
  return { ok: true, data: { deleted: paths?.length ?? 0 } }
}
