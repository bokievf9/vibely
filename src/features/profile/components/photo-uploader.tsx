'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { prepareImage } from '@/lib/image'
import { getBrowserClient } from '@/lib/supabase/client'
import { addPhoto, deletePhoto } from '../actions'
import { invalidateOwnAvatar } from '../own-avatar'
import { moveItem } from '../photo-order'
import { reorderPhotos } from '../photo-order-actions'
import type { OwnPhoto } from '../queries'
import { MAX_PHOTOS } from '../schemas'
import { PhotoTile } from './photo-tile'
import { usePhotoDrag } from './use-photo-drag'

// `nextHref`: where "Continue" leads during onboarding; omit it on the profile page.
type Props = { userId: string; photos: OwnPhoto[]; nextHref?: string }

// Photos are kept contiguous by the database (0..n-1); the first one is the main photo (avatar).
export function PhotoUploader({ userId, photos, nextHref }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const sorted = [...photos].sort((a, b) => a.position - b.position)
  const [ordered, setOrdered] = useOptimistic(sorted, (_, next: OwnPhoto[]) => next)
  const canAdd = ordered.length < MAX_PHOTOS

  const done = () => {
    invalidateOwnAvatar()
    router.refresh()
  }

  const upload = (source: File) =>
    startTransition(async () => {
      if (!canAdd) return
      setError(undefined)
      try {
        const { file, width, height } = await prepareImage(source)
        const path = `${userId}/${crypto.randomUUID()}.webp`
        const { error: uploadError } = await getBrowserClient()
          .storage.from('profile-photos')
          .upload(path, file, { contentType: 'image/webp' })
        if (uploadError) throw uploadError
        const result = await addPhoto({ path, width, height, position: ordered.length })
        if (!result.ok) throw new Error(result.error)
        done()
      } catch {
        setError('photoUploadFailed')
      }
    })

  const remove = (id: string) =>
    startTransition(async () => {
      setOrdered(ordered.filter((p) => p.id !== id))
      const result = await deletePhoto(id)
      if (!result.ok) setError(result.error)
      done()
    })

  const move = (from: number, to: number) =>
    startTransition(async () => {
      const next = moveItem(ordered, from, to)
      setError(undefined)
      setOrdered(next)
      const result = await reorderPhotos(next.map((p) => p.id))
      if (!result.ok) setError(result.error)
      done()
    })

  const { drag, handleProps } = usePhotoDrag(move, pending)

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-3 gap-3">
        {ordered.map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            index={index}
            count={ordered.length}
            pending={pending}
            drag={drag}
            handle={handleProps(index)}
            onMove={(to) => move(index, to)}
            onRemove={() => remove(photo.id)}
          />
        ))}
        {canAdd && (
          <li className="aspect-[3/4]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              aria-label={dict.onboarding.addPhoto}
              className="border-border text-muted flex size-full items-center justify-center rounded-2xl border-2 border-dashed"
            >
              {pending ? <Spinner /> : <Plus className="size-7" />}
            </button>
          </li>
        )}
      </ul>
      {ordered.length > 1 && <p className="text-muted text-xs">{dict.avatar.reorderHint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload(file)
        }}
      />
      <FormError message={errorText(error)} />
      {nextHref && (
        <Button
          onClick={() => router.push(nextHref)}
          disabled={!photos.length || pending}
          fullWidth
          className="mt-2"
        >
          {dict.common.continue}
        </Button>
      )}
    </div>
  )
}
