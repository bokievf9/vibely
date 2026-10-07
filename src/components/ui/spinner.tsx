import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-label="Загрузка"
      role="status"
      className={cn('size-6 animate-spin', className)}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner className="text-muted size-8" />
    </div>
  )
}
