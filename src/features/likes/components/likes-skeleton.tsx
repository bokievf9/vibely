import { Skeleton } from '@/components/ui/skeleton'

// Same grid as "Who liked you": hint line plus 3:4 tiles with a name bar.
export function LikesSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-4" aria-busy="true">
      <Skeleton className="h-4 w-3/4 rounded-full" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="relative aspect-[3/4]">
            <Skeleton className="absolute inset-0" />
            <Skeleton className="bg-fill absolute bottom-3 left-3 h-4 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
