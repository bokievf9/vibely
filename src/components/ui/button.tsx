import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

const variants = {
  primary: 'bg-accent text-accent-foreground active:opacity-90',
  secondary: 'bg-surface text-foreground border border-border active:bg-border',
  ghost: 'text-foreground active:bg-surface',
  danger: 'bg-danger text-white active:opacity-90',
} as const

// sm is 40px tall but its ::before hit area reaches 44px, so small buttons still pass touch-target
// guidelines without looking heavier.
const sizes = {
  md: 'h-12 px-5 text-base',
  sm: "h-10 px-3.5 text-sm before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
  icon: 'size-12 p-0',
} as const

type ButtonProps = ComponentProps<'button'> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-2xl font-semibold select-none',
        // Press feedback on touch-down, not on release (.claude/skills/emil-design-eng).
        'transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.97]',
        'focus-visible:ring-accent focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-5" /> : children}
    </button>
  )
}
