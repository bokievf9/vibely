'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

// Password field with a 44px show/hide button. Autofill hints come from `autoComplete`
// ("current-password" on sign-in, "new-password" in Settings).
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { dict } = useI18n()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('pr-14', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? dict.password.hide : dict.password.show}
        aria-pressed={visible}
        className="text-muted active:text-foreground absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-2xl transition-colors"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}
