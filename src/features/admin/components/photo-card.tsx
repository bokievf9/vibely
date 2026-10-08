'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ShieldOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { revokeVerification } from '../actions'
import type { ActionResult } from '@/types/action-result'
import { deletePhoto } from '../photo-actions'
import { approvePhotos } from '../photo-review-actions'
import type { QueuePhoto, RecentPhoto } from '../queries/photos'
import { Badge, VerificationBadge, formatDate } from './badges'
import { ReasonDialog, textPresets } from './reason-dialog'
import { useModeration } from './use-moderation'

export const DELETE_PRESETS = textPresets([
  'Нет лица или не человек',
  'Чужое фото или знаменитость',
  'Обнажённость или 18+',
  'Контакты или реклама на фото',
  'Оскорбительное содержание',
])
// The moderation hook expects ActionResult<void>.
const toResult = <T,>(r: ActionResult<T>): ActionResult =>
  r.ok ? { ok: true, data: undefined } : r

const REVOKE_PRESETS = textPresets([
  'Фото не совпадают с селфи',
  'Сменил фото на чужие',
  'Подозрение на фейк',
])

export function PhotoCard({
  photo,
  selected = false,
  onSelect,
}: {
  photo: RecentPhoto | QueuePhoto
  selected?: boolean
  onSelect?: (selected: boolean) => void
}) {
  const queued = 'reviewed' in photo ? photo : null
  const verified = !queued || queued.verificationStatus === 'approved'
  const { pending, error, run } = useModeration()
  const [dialog, setDialog] = useState<'delete' | 'revoke' | null>(null)

  const confirm = async (reason: string) => {
    const ok = await run(() =>
      dialog === 'delete'
        ? deletePhoto({ photoId: photo.id, reason })
        : revokeVerification({ userId: photo.userId, reason }),
    )
    if (ok) setDialog(null)
  }

  return (
    <article
      className={`bg-surface relative flex h-full flex-col gap-2 rounded-2xl p-2 ${selected ? 'ring-accent ring-2' : ''}`}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Выбрать фото: ${photo.userName}`}
          className="accent-accent absolute top-3 left-3 z-10 size-6"
        />
      )}
      <a href={photo.url} target="_blank" rel="noreferrer">
        <Image
          src={photo.url}
          alt={`Фото: ${photo.userName}`}
          width={photo.width}
          height={photo.height}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
          className="aspect-[3/4] w-full rounded-xl object-cover"
        />
      </a>
      <div className="flex flex-col px-1 text-sm">
        <Link
          href={`/admin/users/${photo.userId}`}
          className="truncate font-medium hover:underline"
        >
          {photo.userName}
        </Link>
        <time className="text-muted text-xs" dateTime={photo.createdAt}>
          {formatDate(photo.createdAt)}
        </time>
        {queued && (
          <div className="mt-1 flex flex-wrap gap-1">
            <VerificationBadge status={queued.verificationStatus} />
            {queued.reviewed && (
              <Badge className="bg-emerald-500/15 text-emerald-400">Проверено</Badge>
            )}
            {queued.openReports > 0 && (
              <Badge className="bg-red-500/15 text-red-400">Жалоб: {queued.openReports}</Badge>
            )}
          </div>
        )}
      </div>
      <FormError message={dialog ? undefined : error} />
      <div className="mt-auto flex flex-col gap-1.5">
        {queued && !queued.reviewed && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run(() => approvePhotos({ photoIds: [photo.id] }).then(toResult))}
            disabled={pending}
          >
            <Check className="size-4" /> Одобрить
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => setDialog('delete')} disabled={pending}>
          <Trash2 className="size-4" /> Удалить
        </Button>
        {verified && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDialog('revoke')}
            disabled={pending}
          >
            <ShieldOff className="size-4" /> Снять верификацию
          </Button>
        )}
      </div>
      <ReasonDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'delete' ? 'Удалить фото' : `Снять верификацию: ${photo.userName}`}
        confirmLabel={dialog === 'delete' ? 'Удалить' : 'Снять'}
        presets={dialog === 'delete' ? DELETE_PRESETS : REVOKE_PRESETS}
        danger={dialog === 'delete'}
        pending={pending}
        error={error}
        onConfirm={confirm}
      />
    </article>
  )
}
