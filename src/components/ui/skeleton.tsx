import { cn } from '@/lib/utils'

// Layout-shaped placeholder. Size and radius come from className so it matches the final content:
// <Skeleton className="size-14 rounded-full" /> for an avatar, "h-4 w-2/3 rounded-full" for a line.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-surface animate-pulse rounded-2xl', className)} />
}
