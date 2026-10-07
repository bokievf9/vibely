'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type Photo = { url: string; width: number; height: number }

// Tap the left/right half to flip through photos (Tinder-style), with progress bars on top.
export function PhotoCarousel({
  photos,
  alt,
  priority = false,
}: {
  photos: Photo[]
  alt: string
  priority?: boolean
}) {
  const [index, setIndex] = useState(0)
  const photo = photos[index]

  if (!photo) {
    return (
      <div className="bg-surface text-muted flex size-full items-center justify-center">
        <UserRound className="size-20" aria-hidden />
      </div>
    )
  }

  const step = (delta: number) =>
    setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)))

  return (
    <div className="relative size-full">
      <Image
        key={photo.url}
        src={photo.url}
        alt={alt}
        width={photo.width}
        height={photo.height}
        sizes="(max-width: 448px) 100vw, 448px"
        priority={priority}
        draggable={false}
        className="pointer-events-none size-full object-cover select-none"
      />
      {photos.length > 1 && (
        <>
          <div className="absolute inset-x-2 top-2 flex gap-1" aria-hidden>
            {photos.map((p, i) => (
              <span
                key={p.url}
                className={cn('h-1 flex-1 rounded-full', i === index ? 'bg-white' : 'bg-white/35')}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="‹"
            className="absolute inset-y-0 left-0 w-1/3"
            onClick={() => step(-1)}
          />
          <button
            type="button"
            aria-label="›"
            className="absolute inset-y-0 right-0 w-1/3"
            onClick={() => step(1)}
          />
        </>
      )}
    </div>
  )
}
