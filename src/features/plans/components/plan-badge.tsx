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
        'text-footnote inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 font-semibold',
        tone === 'dark' ? 'glass text-white' : 'bg-accent/15 text-accent highlight',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}
