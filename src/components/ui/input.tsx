import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const base =
  'bg-surface border-border placeholder:text-muted w-full rounded-2xl border px-4 text-base outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent focus:ring-accent/20 focus:ring-4 aria-invalid:border-danger aria-invalid:focus:ring-danger/20 disabled:opacity-50'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(base, 'h-12', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(base, 'min-h-28 resize-none py-3', className)} {...props} />
}
