'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type Photo = { url: string; width: number; height: number }

// Tap the left/right half to flip through photos (Tinder-style), with progress bars on top.
// The current photo and its neighbours stay mounted (stable keys), so a tap never remounts or
// re-downloads an image: the next one is already decoded and simply fades in over the old one.
export function PhotoCarousel({
  photos,
  alt,
  priority = false,
}: {
  photos: Photo[]
  alt: string
  priority?: boolean
}) {
  const { dict } = useI18n()
  const t = dict.discoverui
  const [index, setIndex] = useState(0)
  // Photos whose bytes arrived; until then the slot shows the surface, never a half-painted image.
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set())
  const current = Math.min(index, Math.max(0, photos.length - 1))

  if (!photos.length) {
    return (
      <div className="bg-surface text-muted flex size-full items-center justify-center">
        <UserRound className="size-20" aria-hidden />
      </div>
    )
  }

  const step = (delta: number) =>
    setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)))
  const markLoaded = (url: string) => setLoaded((s) => (s.has(url) ? s : new Set(s).add(url)))

  return (
    <div
      className="bg-surface relative size-full"
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
    >
      {photos.map((photo, i) => {
        // Render a window of prev / current / next; farther photos load when they get close.
        if (Math.abs(i - current) > 1) return null
        const shown = i === current
        return (
          <Image
            key={photo.url}
            src={photo.url}
            alt={shown ? fmt(t.photoOf, { n: i + 1, count: photos.length }) + `: ${alt}` : ''}
            aria-hidden={!shown}
            width={photo.width}
            height={photo.height}
            sizes="(max-width: 448px) 100vw, 448px"
            // Neighbours load eagerly: they are invisible but must be ready before the tap.
            {...(priority && i === 0 ? { priority: true } : { loading: 'eager' as const })}
            draggable={false}
            onLoad={() => markLoaded(photo.url)}
            className={cn(
              'pointer-events-none absolute inset-0 size-full object-cover select-none',
              // Incoming photo fades in on top; the outgoing one stays opaque underneath until
              // the fade is done, so the crossfade never dips to the background.
              // The first photo paints at once (it is the LCP on profile pages); later ones fade.
              shown && (i === 0 || loaded.has(photo.url))
                ? 'z-[1] opacity-100 transition-opacity duration-200 ease-out'
                : 'z-0 opacity-0 transition-opacity delay-200 duration-0',
            )}
          />
        )
      })}
      {photos.length > 1 && (
        <>
          <div className="absolute inset-x-2 top-2 z-[2] flex gap-1" aria-hidden>
            {photos.map((p, i) => (
              <span key={p.url} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  className={cn(
                    'block h-full origin-left rounded-full bg-white transition-transform duration-200 ease-out',
                    i <= current ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>
            ))}
          </div>
          <button
            type="button"
            aria-label={t.prevPhoto}
            disabled={current === 0}
            className="absolute inset-y-0 left-0 z-[2] w-1/2 disabled:pointer-events-none"
            onClick={() => step(-1)}
          />
          <button
            type="button"
            aria-label={t.nextPhoto}
            disabled={current === photos.length - 1}
            className="absolute inset-y-0 right-0 z-[2] w-1/2 disabled:pointer-events-none"
            onClick={() => step(1)}
          />
        </>
      )}
    </div>
  )
}
