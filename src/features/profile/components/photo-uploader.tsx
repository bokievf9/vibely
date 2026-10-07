'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { prepareImage } from '@/lib/image'
import { getBrowserClient } from '@/lib/supabase/client'
import { addPhoto, deletePhoto } from '../actions'
import type { OwnPhoto } from '../queries'
import { MAX_PHOTOS } from '../schemas'

// `nextHref`: where "Continue" leads during onboarding; omit it on the profile page.
type Props = { userId: string; photos: OwnPhoto[]; nextHref?: string }

export function PhotoUploader({ userId, photos, nextHref }: Props) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const freePosition = Array.from({ length: MAX_PHOTOS }, (_, i) => i).find(
    (i) => !photos.some((p) => p.position === i),
  )

  const upload = (source: File) =>
    startTransition(async () => {
      if (freePosition === undefined) return
      setError(undefined)
      try {
        const { file, width, height } = await prepareImage(source)
        const path = `${userId}/${crypto.randomUUID()}.webp`
        const { error: uploadError } = await getBrowserClient()
          .storage.from('profile-photos')
          .upload(path, file, { contentType: 'image/webp' })
        if (uploadError) throw uploadError
        const result = await addPhoto({ path, width, height, position: freePosition })
        if (!result.ok) throw new Error(result.error)
        router.refresh()
      } catch {
        setError('photoUploadFailed')
      }
    })

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deletePhoto(id)
      if (!result.ok) setError(result.error)
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-3 gap-3">
        {Array.from({ length: MAX_PHOTOS }, (_, position) => {
          const photo = photos.find((p) => p.position === position)
          return (
            <li
              key={position}
              className="bg-surface relative aspect-[3/4] overflow-hidden rounded-2xl"
            >
              {photo ? (
                <>
                  <Image
                    src={photo.url}
                    alt={fmt(dict.onboarding.photoAlt, { n: position + 1 })}
                    width={photo.width}
                    height={photo.height}
                    sizes="33vw"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => remove(photo.id)}
                    disabled={pending}
                    aria-label={dict.onboarding.deletePhoto}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1"
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : position === freePosition ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={pending}
                  aria-label={dict.onboarding.addPhoto}
                  className="border-border text-muted flex size-full items-center justify-center rounded-2xl border-2 border-dashed"
                >
                  {pending ? <Spinner /> : <Plus className="size-7" />}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
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
        >
          {dict.common.continue}
        </Button>
      )}
    </div>
  )
}
