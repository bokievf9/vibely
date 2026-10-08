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
      <div
        aria-hidden
        className="from-accent/20 to-accent/0 relative mb-6 flex size-24 items-center justify-center rounded-full bg-radial"
      >
        <div className="bg-surface flex size-16 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_8px_24px_-8px_rgb(255_77_125/0.35)] ring-1 ring-white/[0.06]">
          <Icon className="text-accent size-7" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
      {text && (
        <p className="text-muted mt-2 max-w-[30ch] text-[15px] leading-relaxed text-pretty">
          {text}
        </p>
      )}
      {cta && <div className="mt-6 flex flex-col items-center gap-2">{cta}</div>}
    </div>
  )
}
