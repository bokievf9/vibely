import Image from 'next/image'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// Real app screenshot (1170x2532, public/landing/screens) in a thin device bezel. The bezel is
// plain CSS around a real image, not a drawn UI.
export const SCREEN_RATIO = 'aspect-[1170/2532]'

type Props = {
  src: string
  alt: string
  // next/image sizes: the rendered width of the phone at each breakpoint.
  sizes: string
  priority?: boolean
  className?: string
  style?: CSSProperties
}

export function PhoneScreen({ src, alt, sizes, priority = false, className, style }: Props) {
  return (
    <div
      style={style}
      className={cn(
        'relative rounded-[2.25rem] bg-[#060507] p-[5px] shadow-[0_0_0_1px_rgb(255_255_255/0.09),0_32px_64px_-28px_rgb(0_0_0/0.9)]',
        SCREEN_RATIO,
        className,
      )}
    >
      <div className="relative size-full overflow-hidden rounded-[1.95rem] bg-[#0e0b10]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover object-top"
        />
      </div>
    </div>
  )
}
