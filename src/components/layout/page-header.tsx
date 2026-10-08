import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Shared bar geometry for every sticky top bar, including custom ones (chat room, post page):
// 3.5rem of content PLUS the status-bar inset, so in the installed PWA (black-translucent status
// bar) the inset no longer eats the 56px. Sticky children below it use top-[var(--header-h)].
export const headerBarClassName =
  'material-bar sticky top-0 z-30 flex h-[var(--header-h)] shrink-0 items-center pt-[env(safe-area-inset-top)]'

// Hairline that fades in once content scrolls under the bar. Put it as the bar's last child.
export function HeaderEdge() {
  return (
    <span
      aria-hidden
      className="header-edge pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.07]"
    />
  )
}

// Sticky top bar for (main) screens.
export function PageHeader({
  title,
  children,
  className,
}: {
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn(headerBarClassName, 'justify-between gap-3 px-4', className)}>
      <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-1">{children}</div>}
      <HeaderEdge />
    </header>
  )
}
