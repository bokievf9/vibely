import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

const variants = {
  primary: 'bg-accent text-accent-foreground active:opacity-90',
  secondary: 'bg-surface text-foreground border border-border active:bg-border',
  ghost: 'text-foreground active:bg-surface',
  danger: 'bg-red-600 text-white active:opacity-90',
} as const

const sizes = {
  md: 'h-12 px-5 text-base',
  sm: 'h-9 px-3 text-sm',
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
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition select-none',
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
