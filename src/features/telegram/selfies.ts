import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ageFromBirthDate } from '@/lib/utils'
import { CHALLENGES, isChallengeId } from '@/features/verification/challenges'
import type { TgFile } from './api'
import {
  admit,
  deleteMessages,
  editText,
  getBot,
  sendMediaGroup,
  sendPhoto,
  sendText,
} from './client'
import { openOnly, selfieKeyboard } from './keyboards'
import { plain } from './protocol'

// Selfie review in the moderators chat (only with TELEGRAM_SEND_SELFIES=true, otherwise a short
// text notice). The photos are uploaded from the private buckets with the service role (never a
// signed URL), sent with protect_content, and deleted from the chat as soon as the request is
// decided, or after PHOTO_MAX_AGE: Telegram lets bots delete their messages only within 48 h.
export const PHOTO_MAX_AGE = '46 hours'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

type Request = {
  id: string
  user_id: string
  selfie_path: string
  challenge: string
  profiles: {
    display_name: string
    birth_date: string
    profile_photos: { storage_path: string; position: number }[]
  } | null
}

async function pendingRequestOf(userId: string): Promise<Request | null> {
  const { data } = await createAdminClient()
    .from('verification_requests')
    .select(
      'id, user_id, selfie_path, challenge, profiles(display_name, birth_date, profile_photos(storage_path, position))',
    )
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  return data
}

async function download(bucket: 'selfies' | 'profile-photos', path: string, name: string) {
  const { data, error } = await createAdminClient().storage.from(bucket).download(path)
  if (error || !data || data.size > MAX_PHOTO_BYTES) return null
  return { name, data } satisfies TgFile
}

const describe = (r: Request) => {
  const p = r.profiles
  const age = p ? ageFromBirthDate(p.birth_date) : null
  const gesture = isChallengeId(r.challenge) ? CHALLENGES[r.challenge] : plain(r.challenge)
  return `Имя: ${plain(p?.display_name) || 'без имени'}${age ? `, ${age}` : ''}\nЖест: ${gesture}`
}

export async function postSelfie(userId: string) {
  const bot = getBot()
  if (!bot) return
  const r = await pendingRequestOf(userId)
  if (!r) return
  if (!admit('selfie')) return

  if (!bot.env.sendSelfies) {
    await sendText(
      'selfies',
      `📸 Новое селфи на проверку\n${describe(r)}`,
      openOnly('/admin/verification'),
    )
    return
  }

  const selfie = await download('selfies', r.selfie_path, 'selfie.jpg')
  if (!selfie) {
    await sendText(
      'selfies',
      `📸 Новое селфи на проверку (фото не удалось загрузить)\n${describe(r)}`,
      openOnly('/admin/verification'),
    )
    return
  }
  const photoMsg = await sendPhoto('selfies', selfie, `📸 Селфи на проверку\n${describe(r)}`)
  if (!photoMsg) return
  const photoIds = [photoMsg.message_id]

  const photos = [...(r.profiles?.profile_photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
  const files = (
    await Promise.all(photos.map((p, i) => download('profile-photos', p.storage_path, `p${i}.jpg`)))
  ).filter((f): f is TgFile => f !== null)
  if (files.length === 1) {
    const m = await sendPhoto('selfies', files[0]!, 'Фото профиля')
    if (m) photoIds.push(m.message_id)
  } else if (files.length > 1) {
    photoIds.push(...(await sendMediaGroup('selfies', files)).map((m) => m.message_id))
  }

  const control = await sendText(
    'selfies',
    `📸 Селфи на проверку\n${describe(r)}\nФото профиля: ${files.length}`,
    selfieKeyboard(r.id),
  )
  const { error } = await createAdminClient().rpc('telegram_record_message', {
    p_kind: 'selfie',
    p_ref_type: 'verification_request',
    p_ref_id: r.id,
    p_chat: photoMsg.chat.id,
    p_photos: photoIds,
    p_control: control?.message_id ?? 0,
  })
  if (error) {
    // Without the record we could not clean up later: remove the photos right away.
    console.error('[telegram] record selfie failed:', error.code)
    await deleteMessages(photoMsg.chat.id, photoIds)
    if (control) await deleteMessages(photoMsg.chat.id, [control.message_id])
  }
}

type Posted = {
  id: string
  chat_id: number
  photo_message_ids: number[]
  control_message_id: number | null
}

async function openSelfieMessage(requestId: string): Promise<Posted | null> {
  const { data } = await createAdminClient()
    .from('telegram_messages')
    .select('id, chat_id, photo_message_ids, control_message_id')
    .eq('kind', 'selfie')
    .eq('ref_id', requestId)
    .is('closed_at', null)
    .maybeSingle()
  return data
}

// Deletes the photos from the chat (logged once in moderation_actions), replaces the buttons
// with `text` and closes the record.
async function retire(m: Posted, text: string, cause: string, path = '/admin/verification') {
  const db = createAdminClient()
  if (m.photo_message_ids.length) {
    const deleted = await deleteMessages(m.chat_id, m.photo_message_ids)
    if (!deleted) console.error('[telegram] selfie photos not deleted, will retry')
    else await db.rpc('telegram_mark_photos_deleted', { p_id: m.id, p_cause: cause })
  }
  if (m.control_message_id) await editText(m.chat_id, m.control_message_id, text, openOnly(path))
  await db.from('telegram_messages').update({ closed_at: new Date().toISOString() }).eq('id', m.id)
}

// Called after a decision (from Telegram or the panel).
export async function closeSelfie(requestId: string, text: string) {
  const m = await openSelfieMessage(requestId)
  if (m) await retire(m, text, 'decided')
}

const STATUS_TEXT: Record<string, string> = {
  approved: '✅ Одобрено (в админке)',
  rejected: '❌ Отклонено (в админке)',
}

// Cron-safe cleanup: photos of decided requests and of requests older than PHOTO_MAX_AGE.
export async function sweepSelfies(): Promise<number> {
  if (!getBot()) return 0
  const db = createAdminClient()
  const { data, error } = await db.rpc('telegram_photos_to_delete', {
    p_max_age: PHOTO_MAX_AGE,
    p_limit: 50,
  })
  if (error || !data) return 0
  let done = 0
  for (const row of data) {
    const { data: req } = await db
      .from('verification_requests')
      .select('status')
      .eq('id', row.ref_id)
      .maybeSingle()
    const text = row.expired
      ? '⌛ Фото удалены из чата (прошло 46 ч). Решение принимается в админке.'
      : (STATUS_TEXT[req?.status ?? ''] ?? 'Заявка закрыта')
    const deleted = await deleteMessages(row.chat_id, row.photo_message_ids)
    if (!deleted) {
      // Past Telegram's 48 h limit the bot can no longer delete them: stop retrying and ask
      // the moderators to remove the photos by hand.
      if (Date.now() - new Date(row.created_at).getTime() < 48 * 3600_000) continue
      console.error('[telegram] selfie photos could not be deleted: remove them manually')
      await db.rpc('telegram_mark_photos_deleted', { p_id: row.id, p_cause: 'delete_failed' })
      if (row.control_message_id) {
        await editText(
          row.chat_id,
          row.control_message_id,
          '⚠️ Бот не смог удалить фото селфи выше. Удалите их вручную.',
          openOnly('/admin/verification'),
        )
      }
      continue
    }
    await db.rpc('telegram_mark_photos_deleted', {
      p_id: row.id,
      p_cause: row.expired ? 'expired' : 'decided_elsewhere',
    })
    if (row.control_message_id) {
      await editText(
        row.chat_id,
        row.control_message_id,
        `📸 Селфи\n${text}`,
        openOnly('/admin/verification'),
      )
    }
    if (!row.expired || req?.status !== 'pending') {
      await db
        .from('telegram_messages')
        .update({ closed_at: new Date().toISOString() })
        .eq('id', row.id)
    }
    done++
  }
  return done
}
