'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, CircleX, Clock, RotateCcw } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { fmt } from '@/i18n/config'
import { LocaleLink, useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { getOrderStatus } from '../actions'
import type { OrderStatus, PaidPlan } from '../types'

const FAST_MS = 2000
const SLOW_MS = 10000
// After this long the page says "still waiting" and polls less often.
const SLOW_AFTER_MS = 60000
const GIVE_UP_MS = 10 * 60000

// /plans/return: the order's status as the database knows it. The gateway's redirect back is not
// proof of payment; only its webhook changes the order, so a pending order is polled until it
// settles.
export function OrderStatusView({
  orderId,
  initial,
}: {
  orderId: string
  initial: { status: OrderStatus; plan: PaidPlan } | null
}) {
  const { dict } = useI18n()
  const t = dict.payments.return
  const [order, setOrder] = useState(initial)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (order?.status !== 'pending') return
    const started = Date.now()
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const tick = async () => {
      const elapsed = Date.now() - started
      if (elapsed > SLOW_AFTER_MS) setSlow(true)
      if (elapsed > GIVE_UP_MS || stopped) return
      const result = await getOrderStatus(orderId).catch(() => null)
      if (stopped) return
      if (result?.ok && result.data && result.data.status !== 'pending') {
        setOrder(result.data)
        return
      }
      timer = setTimeout(tick, elapsed > SLOW_AFTER_MS ? SLOW_MS : FAST_MS)
    }
    timer = setTimeout(tick, FAST_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [order?.status, orderId])

  if (!order) {
    return <Panel tone="muted" icon={<CircleX className="size-7" />} title={t.notFound} />
  }
  const plan = dict.plans.names[order.plan]
  switch (order.status) {
    case 'pending':
      return (
        <Panel
          tone="muted"
          icon={<Spinner className="size-7" />}
          title={t.pending}
          body={slow ? t.slow : t.pendingBody}
          live
        />
      )
    case 'paid':
      return (
        <Panel
          tone="success"
          icon={<CircleCheck className="size-7" />}
          title={t.paid}
          body={fmt(t.paidBody, { plan })}
          live
        />
      )
    case 'refunded':
      return (
        <Panel
          tone="muted"
          icon={<RotateCcw className="size-7" />}
          title={t.refunded}
          body={t.refundedBody}
        />
      )
    case 'failed':
      return (
        <Panel
          tone="danger"
          icon={<CircleX className="size-7" />}
          title={t.failed}
          body={t.failedBody}
          live
        />
      )
    default:
      return (
        <Panel
          tone="muted"
          icon={<Clock className="size-7" />}
          title={t.cancelled}
          body={t.cancelledBody}
          live
        />
      )
  }
}

function Panel({
  tone,
  icon,
  title,
  body,
  live = false,
}: {
  tone: 'success' | 'danger' | 'muted'
  icon: React.ReactNode
  title: string
  body?: string
  live?: boolean
}) {
  const { dict } = useI18n()
  const t = dict.payments.return
  return (
    <div className="flex flex-col items-center gap-5 px-4 pt-6 pb-10 text-center">
      <span
        className={cn(
          'flex size-16 items-center justify-center rounded-full',
          tone === 'success' && 'bg-success/15 text-success',
          tone === 'danger' && 'bg-danger/15 text-danger',
          tone === 'muted' && 'bg-fill text-muted',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex flex-col gap-2" role={live ? 'status' : undefined} aria-live="polite">
        <h2 className="text-title2 text-balance">{title}</h2>
        {body && <p className="text-muted text-callout max-w-[36ch] text-pretty">{body}</p>}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <LocaleLink
          href="/plans"
          className="btn-accent flex h-[3.25rem] items-center justify-center rounded-2xl text-[1.0625rem] font-semibold"
        >
          {t.toPlans}
        </LocaleLink>
        <LocaleLink
          href="/settings/payments"
          className="text-accent flex h-11 items-center justify-center text-[15px] font-semibold"
        >
          {t.toHistory}
        </LocaleLink>
      </div>
    </div>
  )
}
