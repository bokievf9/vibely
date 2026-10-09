'use client'

import { useId, useState } from 'react'
import { ChevronDown, Ticket } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'

type Props = { error?: string; registration: UseFormRegisterReturn }

// Onboarding: "Have a promo code?" folds a single optional input. Opens by itself when the
// field already has an error (a rejected code after the profile was created).
export function PromoField({ error, registration }: Props) {
  const { dict } = useI18n()
  const t = dict.promo
  const id = useId()
  const [open, setOpen] = useState(false)
  const shown = open || Boolean(error)
  return (
    <div className="card flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        aria-controls={`${id}-panel`}
        className="active:bg-fill flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 text-left text-[16px] font-medium tracking-[-0.01em] transition-colors"
      >
        <span className="icon-tile">
          <Ticket className="size-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">{t.haveCode}</span>
        <span className="text-muted text-footnote font-normal">{t.optional}</span>
        <ChevronDown
          className={cn(
            'text-muted size-5 shrink-0 transition-transform duration-200 ease-out',
            shown && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <div id={`${id}-panel`} hidden={!shown} className="border-border border-t px-4 pt-3 pb-4">
        <Field label={t.label} htmlFor="promoCode" error={error} hint={t.intro}>
          <Input
            id="promoCode"
            placeholder={t.placeholder}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby="promoCode-msg"
            className="font-mono uppercase tracking-[0.08em]"
            {...registration}
          />
        </Field>
      </div>
    </div>
  )
}
