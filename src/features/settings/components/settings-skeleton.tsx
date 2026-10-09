import { Skeleton } from '@/components/ui/skeleton'

// Shape of the settings screen while it streams: section titles and cards with switch rows.
export function SettingsSkeleton({ label }: { label: string }) {
  const section = (rows: number, key: number) => (
    <div key={key} className="flex flex-col gap-3">
      <Skeleton className="h-3.5 w-28 rounded-full" />
      <div className="card divide-border flex flex-col divide-y border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-14 items-center justify-between gap-3 px-4">
            <span className="flex items-center gap-2">
              <Skeleton className="bg-fill size-5 rounded-full" />
              <Skeleton className="bg-fill h-3.5 w-36 rounded-full" />
            </span>
            <Skeleton className="bg-fill h-7 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <div className="flex flex-col gap-8 px-4 pb-6" role="status" aria-label={label}>
      {[3, 2, 1].map((rows, i) => section(rows, i))}
    </div>
  )
}
