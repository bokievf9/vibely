import Image from 'next/image'
import type { SignedPhoto } from '../queries/storage'

// Horizontal row of a user's profile photos, for comparing with the selfie.
export function PhotoStrip({ photos, label }: { photos: SignedPhoto[]; label: string }) {
  if (!photos.length) return <p className="text-muted text-sm">Нет фото</p>
  return (
    <ul className="flex gap-2 overflow-x-auto" aria-label={label}>
      {photos.map((photo, i) => (
        <li key={photo.url} className="shrink-0">
          <a href={photo.url} target="_blank" rel="noreferrer">
            <Image
              src={photo.url}
              alt={`${label}, фото ${i + 1}`}
              width={photo.width}
              height={photo.height}
              sizes="120px"
              className="h-40 w-auto rounded-xl object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  )
}
