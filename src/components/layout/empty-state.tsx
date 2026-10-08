import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  /** What the screen will show, and how to get there. */
  text?: string
  /** The one action that fills this screen (a Button or a LocaleLink styled as one). */
  action?: ReactNode
  /** Same slot as `action`, kept for existing callers. */
  children?: ReactNode
  className?: string
}

// Composed empty screen: a soft accent halo around the icon, a short title, one line on how to
// fill it, and at most one action. Centered in the space it is given (flex-1).
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  children,
  className,
}: EmptyStateProps) {
  const cta = action ?? children
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-8 py-16 text-center',
        className,
      )}
    >
      <div aria-hidden className="relative mb-7 flex size-28 items-center justify-center">
        <span className="from-accent/25 to-accent/0 absolute inset-[-12px] rounded-full bg-radial" />
        <span className="absolute inset-0 rounded-full border border-white/[0.05]" />
        <span className="absolute inset-3 rounded-full border border-white/[0.07]" />
        <div className="card-raised relative flex size-[4.5rem] items-center justify-center rounded-[1.375rem]">
          <Icon className="text-accent size-8" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="text-title2 text-balance">{title}</h2>
      {text && <p className="text-muted text-callout mt-2 max-w-[32ch] text-pretty">{text}</p>}
      {cta && <div className="mt-6 flex flex-col items-center gap-2">{cta}</div>}
    </div>
  )
}
