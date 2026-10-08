'use client'

import { LoaderCircle } from 'lucide-react'
import { useOptionalI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

// Prefer a <Skeleton> shaped like the content; a spinner is for actions in progress.
export function Spinner({ className, label }: { className?: string; label?: string }) {
  // Admin panel renders without the i18n provider and is Russian-only.
  const fallback = useOptionalI18n()?.dict.common.loading ?? 'Загрузка'
  return (
    <LoaderCircle
      aria-label={label ?? fallback}
      role="status"
      className={cn('size-6 animate-spin', className)}
    />
  )
}

// Route-level fallback. It only appears when loading takes longer than ~350ms, so fast
// navigations never flash a spinner.
export function PageSpinner() {
  return (
    <div className="delayed-appear flex flex-1 items-center justify-center py-20">
      <Spinner className="text-muted size-8" />
    </div>
  )
}
