import { cn } from '@/lib/utils'

// Abstract stand-in for a hidden person: two soft colour fields picked from the alias number, so
// "Partner #402" always looks the same within a session. Pure CSS, never derived from a photo.
export function AliasAvatar({
  alias,
  size = 40,
  className,
}: {
  alias: number
  size?: number
  className?: string
}) {
  const hue = (alias * 137) % 360
  const second = (hue + 48 + (alias % 5) * 14) % 360
  const angle = (alias * 53) % 360
  return (
    <span
      aria-hidden
      className={cn('relative inline-block shrink-0 overflow-hidden rounded-full', className)}
      style={{
        // size 0: the parent sizes it (className).
        ...(size > 0 && { width: size, height: size }),
        background: `linear-gradient(${angle}deg, hsl(${hue} 70% 58%), hsl(${second} 72% 42%))`,
      }}
    >
      <span
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 60% at ${30 + (alias % 40)}% ${25 + (alias % 30)}%, hsl(${(hue + 180) % 360} 90% 75% / 0.55), transparent 70%)`,
        }}
      />
      <span className="absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_0_0_1px_rgb(255_255_255/0.08)]" />
    </span>
  )
}
