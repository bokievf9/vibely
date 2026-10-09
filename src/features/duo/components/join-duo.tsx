'use client'

import { useState, useTransition } from 'react'
import { UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { acceptDuo } from '../actions'

export function JoinDuo({ code, hasDuo }: { code: string | null; hasDuo: boolean }) {
  const { dict } = useI18n()
  const t = dict.duo
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [error, setError] = useState<ErrorKey | undefined>(
    !code ? 'duoInviteInvalid' : hasDuo ? 'duoActive' : undefined,
  )
  const [pending, startTransition] = useTransition()

  const join = () =>
    startTransition(async () => {
      if (!code) return
      const result = await acceptDuo({ code })
      if (!result.ok) return setError(result.error)
      router.replace('/swipe?mode=duo')
    })

  return (
    <section className="flex flex-col items-center gap-4 pt-6 text-center">
      <span
        aria-hidden
        className="bg-accent-gradient text-accent-foreground flex size-16 items-center justify-center rounded-[1.375rem]"
      >
        <UsersRound className="size-8" />
      </span>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.025em]">{t.setupTitle}</h1>
      <p className="text-muted max-w-sm">{t.joinText}</p>
      <FormError message={errorText(error)} />
      <Button fullWidth loading={pending} disabled={!code || hasDuo} onClick={join}>
        {t.accept}
      </Button>
      <Button variant="ghost" fullWidth onClick={() => router.replace('/swipe')}>
        {dict.common.cancel}
      </Button>
    </section>
  )
}
