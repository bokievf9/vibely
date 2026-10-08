import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// A titled group of settings. `card` wraps the rows in one rounded card with dividers.
export function SettingsSection({
  title,
  card = true,
  children,
}: {
  title: string
  card?: boolean
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted text-sm font-medium">{title}</h2>
      <div
        className={cn(
          card
            ? 'bg-surface border-border divide-border flex flex-col divide-y overflow-hidden rounded-2xl border'
            : 'flex flex-col gap-3',
        )}
      >
        {children}
      </div>
    </section>
  )
}
