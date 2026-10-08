import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ChipProps = Omit<ComponentProps<'button'>, 'type'> & { selected?: boolean }

// 40px pill with an invisible 44px hit area (::before), so dense chip rows stay tappable.
export function chipClassName(selected: boolean, className?: string) {
  return cn(
    'relative inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium select-none',
    "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
    'transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]',
    'focus-visible:ring-accent focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
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
