'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useOwnAvatar } from '../own-avatar'

const SIZE = 24

// The bottom nav "Profile" tab: the viewer's round main photo, or the fallback icon.
// Decorative: the tab's text label already names it.
export function NavAvatar({ active, fallback }: { active: boolean; fallback: ReactNode }) {
  const url = useOwnAvatar()
  if (!url) return fallback
  return (
    <Image
      src={url}
      alt=""
      aria-hidden
      width={SIZE}
      height={SIZE}
      sizes={`${SIZE}px`}
      className={cn(
        'size-6 rounded-full object-cover',
        active ? 'ring-accent ring-2' : 'ring-border ring-1',
      )}
    />
  )
}
