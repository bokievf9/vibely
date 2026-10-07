import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ChipProps = Omit<ComponentProps<'button'>, 'type'> & { selected?: boolean }

export function chipClassName(selected: boolean, className?: string) {
  return cn(
    'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition select-none',
    selected
      ? 'border-accent bg-accent/15 text-accent'
      : 'border-border bg-surface text-foreground active:bg-border',
    className,
  )
}

// Toggleable pill for tags and multi-select options. For navigation, use a Link with chipClassName.
export function Chip({ selected = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={chipClassName(selected, className)}
      {...props}
    />
  )
}
