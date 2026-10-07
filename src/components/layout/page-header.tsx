import type { ReactNode } from 'react'

// Sticky top bar for (main) screens.
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <h1 className="truncate text-xl font-bold">{title}</h1>
      {children && <div className="flex items-center gap-1">{children}</div>}
    </header>
  )
}
