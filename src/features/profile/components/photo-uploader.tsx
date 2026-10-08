'use client'

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
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
  // UI only: the picked file shown in its future slot until the refreshed list contains it.
  const [preview, setPreview] = useState<{ url: string; count: number } | null>(null)
  const uploading = preview !== null && preview.count === photos.length
  const [optionsFor, setOptionsFor] = useState<number | null>(null)

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  const done = () => {
    invalidateOwnAvatar()
    router.refresh()
  }

  const upload = (source: File) => {
    if (canAdd) setPreview({ url: URL.createObjectURL(source), count: photos.length })
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
        setPreview(null)
        setError('photoUploadFailed')
      }
    })
  }

  // A landed upload's preview is stale from here on (its count could match again after a delete).
  const remove = (id: string) => {
    setPreview(null)
    startTransition(async () => {
      setOrdered(ordered.filter((p) => p.id !== id))
      const result = await deletePhoto(id)
      if (!result.ok) setError(result.error)
      done()
    })
  }

  const move = (from: number, to: number) => {
    setPreview(null)
    startTransition(async () => {
      const next = moveItem(ordered, from, to)
      setError(undefined)
      setOrdered(next)
      const result = await reorderPhotos(next.map((p) => p.id))
      if (!result.ok) setError(result.error)
      done()
    })
  }

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
            onOptions={() => setOptionsFor(index)}
            onRemove={() => remove(photo.id)}
          />
        ))}
        {uploading && preview && (
          <li
            className="bg-surface relative aspect-[3/4] overflow-hidden rounded-2xl"
            role="status"
            aria-label={dict.discoverui.uploading}
          >
            {/* A local blob: next/image can't optimize it and doesn't need to. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt=""
              className="size-full object-cover opacity-50 blur-[2px]"
            />
            <span className="absolute inset-0 flex items-center justify-center text-white">
              <Spinner className="size-7" />
            </span>
          </li>
        )}
        {canAdd && ordered.length + (uploading ? 1 : 0) < MAX_PHOTOS && (
          <li className="aspect-[3/4]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              aria-label={dict.onboarding.addPhoto}
              className="border-border text-muted active:bg-surface active:border-accent/60 active:text-accent flex size-full items-center justify-center rounded-2xl border-2 border-dashed transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
            >
              <Plus className="size-7" />
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
      <PhotoOptions
        index={optionsFor}
        count={ordered.length}
        onClose={() => setOptionsFor(null)}
        onMove={(from, to) => {
          setOptionsFor(null)
          move(from, to)
        }}
      />
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

type OptionsProps = {
  index: number | null
  count: number
  onClose: () => void
  onMove: (from: number, to: number) => void
}

// Button-only reordering (the accessible alternative to dragging), one sheet for the whole grid.
function PhotoOptions({ index, count, onClose, onMove }: OptionsProps) {
  const { dict } = useI18n()
  const t = dict.avatar
  const items =
    index === null
      ? []
      : [
          index > 0 && { icon: Star, label: t.makeMain, to: 0 },
          index > 0 && { icon: ArrowLeft, label: t.moveLeft, to: index - 1 },
          index < count - 1 && { icon: ArrowRight, label: t.moveRight, to: index + 1 },
        ].filter((i) => i !== false)

  return (
    <Modal open={index !== null} onClose={onClose} title={dict.discoverui.photoOptions}>
      <ul className="flex flex-col gap-2">
        {items.map(({ icon: Icon, label, to }) => (
          <li key={label}>
            <Button
              variant="secondary"
              fullWidth
              className="justify-start"
              onClick={() => index !== null && onMove(index, to)}
            >
              <Icon className="text-accent size-5" aria-hidden /> {label}
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
