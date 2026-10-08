import { cn } from '@/lib/utils'

// Layout-shaped placeholder. Size and radius come from className so it matches the final content:
// <Skeleton className="size-14 rounded-full" /> for an avatar, "h-4 w-2/3 rounded-full" for a line.
// A soft highlight sweeps across it; with reduced motion it stays a still surface.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'skeleton-shimmer bg-surface-raised relative overflow-hidden rounded-2xl',
        className,
      )}
    />
  )
}
