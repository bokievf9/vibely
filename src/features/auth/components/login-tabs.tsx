'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { PhoneForm } from './phone-form'
import { UsernameLoginForm } from './username-login-form'

const METHODS = ['phone', 'username'] as const
type Method = (typeof METHODS)[number]

const PILL_SPRING = { type: 'spring', duration: 0.35, bounce: 0.15 } as const

// Login: "Phone" (SMS code, also creates new accounts) or "Username" (password, for accounts
// that set one in Settings). Only the active form is mounted, so one captcha widget at a time.
export function LoginTabs() {
  const { dict } = useI18n()
  const t = dict.password
  const [method, setMethod] = useState<Method>('phone')
  const label: Record<Method, string> = { phone: t.tabPhone, username: t.tabUsername }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={t.methods}
        className="bg-surface grid grid-cols-2 gap-1 rounded-full p-1"
      >
        {METHODS.map((m) => {
          const selected = method === m
          return (
            <button
              key={m}
              id={`login-tab-${m}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="login-panel"
              onClick={() => setMethod(m)}
              className={cn(
                'relative h-11 min-w-0 rounded-full px-2 text-sm font-medium transition-colors',
                selected ? 'text-accent-foreground' : 'text-muted active:text-foreground',
              )}
            >
              {selected && (
                <motion.span
                  layoutId="login-tab-pill"
                  transition={PILL_SPRING}
                  className="bg-accent absolute inset-0 rounded-full"
                  aria-hidden
                />
              )}
              <span className="relative block truncate">{label[m]}</span>
            </button>
          )
        })}
      </div>
      <div id="login-panel" role="tabpanel" aria-labelledby={`login-tab-${method}`}>
        {method === 'phone' ? (
          <PhoneForm key="phone" />
        ) : (
          <UsernameLoginForm key="username" onUsePhone={() => setMethod('phone')} />
        )}
      </div>
    </div>
  )
}
