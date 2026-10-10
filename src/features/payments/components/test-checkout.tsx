'use client'

import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import { completeTestCheckout } from '../actions'

// The fake gateway's page (staff, test mode): "Pay (test)" / "Fail (test)" fire the same handler
// a verified webhook does, then go to the return page like a real gateway's redirect would.
export function TestCheckout({
  orderId,
  title,
  amount,
}: {
  orderId: string
  title: string
  amount: string
}) {
  const { dict } = useI18n()
  const t = dict.payments.test
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const [pending, setPending] = useState<'paid' | 'failed' | null>(null)

  async function finish(outcome: 'paid' | 'failed') {
    if (pending) return
    setPending(outcome)
    const result = await completeTestCheckout(orderId, outcome).catch(() => null)
    if (!result?.ok) {
      toast(errorText(result?.error) ?? dict.errors.generic, 'error')
      setPending(null)
      return
    }
    router.replace(`/plans/return?order=${orderId}`)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-10">
      <div className="card flex items-start gap-3 border-amber-400/40 px-4 py-3">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
        <p className="text-callout text-pretty">{t.body}</p>
      </div>
      <dl className="card divide-border flex flex-col divide-y">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted">{dict.plans.screen.title}</dt>
          <dd className="text-right font-semibold">{title}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted">{t.amount}</dt>
          <dd className="font-semibold tabular-nums">{amount}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <Button
          fullWidth
          loading={pending === 'paid'}
          disabled={pending !== null}
          onClick={() => void finish('paid')}
        >
          {t.pay}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          loading={pending === 'failed'}
          disabled={pending !== null}
          onClick={() => void finish('failed')}
        >
          {t.fail}
        </Button>
      </div>
    </div>
  )
}
