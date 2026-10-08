import { cn } from '@/lib/utils'
import { PLAN_ICONS, type PlanTag } from '../tags'

type Props = {
  tag: PlanTag
  label: string
  // 'dark' sits on photos (swipe card, likes grid), 'light' on the page background.
  tone?: 'dark' | 'light'
  className?: string
}

// "Coffee buddy" pill with its icon. No hooks, so server and client components can both use it.
export function PlanBadge({ tag, label, tone = 'light', className }: Props) {
  const Icon = PLAN_ICONS[tag]
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'dark'
          ? 'bg-accent/90 text-accent-foreground'
          : 'bg-accent/15 text-accent border-accent/30 border',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}
