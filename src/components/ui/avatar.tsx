import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  photo: { url: string; width: number; height: number } | null
  alt: string
  size?: number
  className?: string
}

export function Avatar({ photo, alt, size = 48, className }: Props) {
  return (
    <span
      className={cn(
        'bg-surface text-muted inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photo ? (
        <Image
          src={photo.url}
          alt={alt}
          width={size}
          height={size}
          sizes={`${size}px`}
          draggable={false}
          className="size-full object-cover select-none"
        />
      ) : (
        <UserRound className="size-1/2" aria-hidden />
      )}
    </span>
  )
}
