import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon
  title: string
  text?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Icon className="text-muted size-14" aria-hidden />
      <h2 className="text-xl font-semibold">{title}</h2>
      {text && <p className="text-muted max-w-xs">{text}</p>}
      {children}
    </div>
  )
}
