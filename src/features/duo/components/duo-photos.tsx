'use client'

import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DuoPerson } from '../types'

// Both main photos side by side, each with the first name and age over a soft gradient.
export function DuoPhotos({
  members,
  className,
  sizes = '(max-width: 448px) 50vw, 224px',
  priority = false,
}: {
  members: DuoPerson[]
  className?: string
  sizes?: string
  priority?: boolean
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-1', className)}>
      {members.slice(0, 2).map((m) => (
        <figure key={m.id} className="bg-surface-raised relative min-h-0 overflow-hidden">
          {m.photo ? (
            <Image
              src={m.photo.url}
              alt={m.name}
              fill
              sizes={sizes}
              priority={priority}
              draggable={false}
              className="object-cover select-none"
            />
          ) : (
            <span className="text-muted flex size-full items-center justify-center">
              <UserRound className="size-12" aria-hidden />
            </span>
          )}
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-10 pb-3 text-white">
            <span className="block truncate text-lg leading-tight font-bold tracking-[-0.01em]">
              {m.name}
              {m.age !== null && <span className="font-normal">, {m.age}</span>}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

// Two overlapping avatars (duo inbox rows, chat headers).
export function DuoAvatars({ members, size = 44 }: { members: DuoPerson[]; size?: number }) {
  return (
    <span className="relative flex shrink-0" style={{ width: size * 1.6, height: size }}>
      {members.slice(0, 2).map((m, i) => (
        <span
          key={m.id}
          className="bg-surface-raised ring-background absolute top-0 overflow-hidden rounded-full ring-2"
          style={{ width: size, height: size, left: i * size * 0.6 }}
        >
          {m.photo ? (
            <Image src={m.photo.url} alt="" fill sizes={`${size}px`} className="object-cover" />
          ) : (
            <span className="text-muted flex size-full items-center justify-center">
              <UserRound className="size-1/2" aria-hidden />
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
