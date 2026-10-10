'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { BillingPeriod } from '@/features/plans/pricing'
import { startCheckout } from '../actions'
import type { PaidPlan } from '../types'

// "Get Plus" / "Get VIP" when checkout is open to the viewer. The server creates the order and
// answers with the gateway's checkout URL (or the in-app test checkout); the browser goes there.
// Whether the purchase succeeded is never decided here: only the gateway's webhook marks it paid.
export function CheckoutButton({
  plan,
  period,
  test,
}: {
  plan: PaidPlan
  period: BillingPeriod
  test: boolean
}) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const [pending, setPending] = useState(false)
  const label = fmt(test ? dict.payments.buyTest : dict.payments.buy, {
    plan: dict.plans.names[plan],
  })

  async function go() {
    if (pending) return
    setPending(true)
    try {
      const result = await startCheckout({ plan, period })
      if (!result.ok) {
        toast(errorText(result.error) ?? dict.errors.generic, 'error')
        setPending(false)
        return
      }
      // Stays "loading" while the browser leaves for the checkout.
      window.location.assign(result.data.redirectUrl)
    } catch {
      toast(dict.errors.generic, 'error')
      setPending(false)
    }
  }

  return (
    <Button fullWidth loading={pending} onClick={() => void go()}>
      {label}
    </Button>
  )
}
