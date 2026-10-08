import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

const variants = {
  primary: 'btn-accent active:brightness-95',
  secondary: 'bg-surface-raised text-foreground border border-border highlight active:bg-fill',
  ghost: 'text-foreground active:bg-fill',
  danger: 'bg-danger-strong text-white highlight active:brightness-95',
} as const

// sm is 40px tall but its ::before hit area reaches 44px, so small buttons still pass touch-target
// guidelines without looking heavier.
const sizes = {
  md: 'h-[3.25rem] px-5 text-[1.0625rem] tracking-[-0.012em]',
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
        'transition-[transform,scale,opacity,background-color,filter] duration-150 ease-out active:scale-[0.97]',
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
