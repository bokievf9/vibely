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
    <section className="flex flex-col gap-2">
      <h2 className="text-muted text-footnote px-1 font-semibold tracking-[0.01em]">{title}</h2>
      <div
        className={cn(
          card
            ? 'card divide-border flex flex-col divide-y overflow-hidden'
            : 'flex flex-col gap-3',
        )}
      >
        {children}
      </div>
    </section>
  )
}
