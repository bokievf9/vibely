import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const base =
  'bg-surface border-border placeholder:text-muted w-full rounded-2xl border px-4 text-base outline-none transition focus:border-accent aria-invalid:border-red-500 disabled:opacity-50'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(base, 'h-12', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(base, 'min-h-28 resize-none py-3', className)} {...props} />
}
