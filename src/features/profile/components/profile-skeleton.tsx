import { Skeleton } from '@/components/ui/skeleton'

// Own profile page: header (photo, name, @username), the two actions, then the photo grid.
export function OwnProfileSkeleton() {
  return (
    <div className="flex flex-col gap-7 px-4 pb-8" aria-busy="true">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 pt-2">
          <Skeleton className="size-[128px] shrink-0 rounded-full" />
          <Skeleton className="h-8 w-1/2 rounded-full" />
          <Skeleton className="h-4 w-1/3 rounded-full" />
        </div>
        <Skeleton className="h-[6.5rem] rounded-3xl" />
      </section>
      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16 rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      </section>
    </div>
  )
}

// Someone else's profile: the 3:4 photo, then name and a few lines.
export function PublicProfileSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <Skeleton className="aspect-[3/4] w-full rounded-none rounded-b-[2rem]" />
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-9 w-2/3 rounded-full" />
        <Skeleton className="h-4 w-1/3 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-4/5 rounded-full" />
      </div>
    </div>
  )
}

// Edit form: label + field pairs, in the same rhythm as the real form.
export function EditProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-6" aria-busy="true">
      {['h-12', 'h-12', 'h-12', 'h-28', 'h-40'].map((h, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className={h} />
        </div>
      ))}
    </div>
  )
}
