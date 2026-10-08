import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FieldProps = {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}

// Label + control + hint/error. Pass `aria-invalid` and `aria-describedby={`${id}-msg`}` to the control.
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  const message = error ?? hint
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-muted text-footnote px-1 font-medium">
        {label}
      </label>
      {children}
      {message && (
        <p
          id={htmlFor ? `${htmlFor}-msg` : undefined}
          role={error ? 'alert' : undefined}
          className={cn('text-sm', error ? 'text-danger' : 'text-muted')}
        >
          {message}
        </p>
      )}
    </div>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm">
      {message}
    </p>
  )
}
