'use client'

import { cn } from '@/lib/utils'

type SwitchProps = {
  checked: boolean
  onToggle: () => void
  label: string
  disabled?: boolean
}

// iOS-style on/off switch. The label is for screen readers; the visible text sits next to it.
export function Switch({ checked, onToggle, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 size-5 rounded-full bg-white transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
