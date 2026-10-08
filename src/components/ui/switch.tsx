'use client'

import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

type SwitchProps = {
  checked: boolean
  onToggle: () => void
  label: string
  disabled?: boolean
}

// iOS-style on/off switch. The label is for screen readers; the visible text sits next to it.
// Pressing stretches the thumb toward the travel direction; release springs it across.
export function Switch({ checked, onToggle, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic('light')
        onToggle()
      }}
      className={cn(
        'group relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out disabled:opacity-50',
        'focus-visible:ring-accent focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        // Invisible 44px hit area around the 28px track.
        "before:absolute before:-inset-2 before:content-['']",
        checked ? 'bg-accent' : 'bg-white/[0.14]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'bg-foreground absolute top-1 left-1 h-5 w-5 rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.35)]',
          'ease-spring transition-[translate,width] duration-500 group-active:w-[26px]',
          checked ? 'translate-x-5 group-active:translate-x-[14px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
