import { Skeleton } from '@/components/ui/skeleton'

// Same footprint as the deck (card + round buttons), so nothing jumps when the first card lands.
export function DeckSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true">
      <div className="relative min-h-[420px] flex-1">
        <Skeleton className="absolute inset-0 rounded-3xl" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-5">
          <Skeleton className="bg-border h-8 w-1/2 rounded-full" />
          <Skeleton className="bg-border h-4 w-1/3 rounded-full" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="bg-border h-5 w-20 rounded-full" />
            <Skeleton className="bg-border h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-8">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="size-16 rounded-full" />
      </div>
    </div>
  )
}

// Route-level fallback: header bar height plus the deck, before the client deck mounts.
export function DiscoverSkeleton() {
  return (
    <>
      <div className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <Skeleton className="h-6 w-28 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="size-10 rounded-2xl" />
          <Skeleton className="size-10 rounded-2xl" />
          <Skeleton className="size-10 rounded-2xl" />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <DeckSkeleton />
      </div>
    </>
  )
}
