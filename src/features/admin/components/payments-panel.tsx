'use client'

import { useState, type FormEvent } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatSen } from '@/features/plans/pricing'
import { listOrders, refundOrder, setPrice } from '../payments-actions'
import { PLAN_LABELS } from '../plans-labels'
import type { AdminOrder, AdminPrice } from '../queries/payments'
import { Badge, formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Ожидает', className: 'bg-amber-500/15 text-amber-400' },
  paid: { label: 'Оплачен', className: 'bg-emerald-500/15 text-emerald-400' },
  failed: { label: 'Ошибка оплаты', className: 'bg-red-500/15 text-red-400' },
  refunded: { label: 'Возврат', className: 'bg-border text-muted' },
  cancelled: { label: 'Отменён', className: 'bg-border text-muted' },
  expired: { label: 'Истёк', className: 'bg-border text-muted' },
}
const FILTERS = [null, 'paid', 'pending', 'failed', 'refunded', 'cancelled', 'expired'] as const
const MONTHS = [1, 3, 12] as const
const monthsLabel = (m: number) => (m === 1 ? '1 мес.' : m === 3 ? '3 мес.' : '12 мес.')

// Orders: recent first, filter by status, full refund (admin, confirmation, logged).
export function PaymentOrders({ initial }: { initial: AdminOrder[] }) {
  const { pending, error, run } = useAdminAction()
  const [orders, setOrders] = useState(initial)
  const [status, setStatus] = useState<(typeof FILTERS)[number]>(null)
  const [notice, setNotice] = useState<string>()

  const load = async (s: (typeof FILTERS)[number]) => {
    setStatus(s)
    setNotice(undefined)
    const r = await run(() => listOrders({ status: s }))
    if (r.ok) setOrders(r.data)
  }

  const refund = async (o: AdminOrder) => {
    const who = o.name ?? 'удалённый аккаунт'
    if (
      !confirm(
        `Вернуть ${formatSen(o.amountSen)} за ${PLAN_LABELS[o.plan]} (${monthsLabel(o.periodMonths)}), ${who}?\n\n` +
          'План из этой покупки будет отозван сразу. Если платёжная система не умеет возвращать ' +
          'деньги автоматически, сначала верните их в её кабинете.',
      )
    )
      return
    const reason = prompt('Причина возврата (видна в журнале):', '') ?? null
    if (reason === null) return
    setNotice(undefined)
    const r = await run(() => refundOrder({ orderId: o.id, reason }))
    if (r.ok) {
      setNotice('Возврат оформлен')
      await load(status)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Статус">
        {FILTERS.map((f) => (
          <Chip key={f ?? 'all'} selected={status === f} onClick={() => void load(f)}>
            {f ? (STATUS_LABELS[f]?.label ?? f) : 'Все'}
          </Chip>
        ))}
      </div>
      <FormError message={error} />
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      {orders.length === 0 ? (
        <p className="text-muted text-sm">Заказов нет</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => {
            const s = STATUS_LABELS[o.status] ?? { label: o.status, className: 'bg-border' }
            return (
              <li
                key={o.id}
                className="bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {PLAN_LABELS[o.plan]} · {monthsLabel(o.periodMonths)}
                </span>
                <span className="font-semibold tabular-nums">{formatSen(o.amountSen)}</span>
                <Badge className={s.className}>{s.label}</Badge>
                {o.provider === 'test' && (
                  <Badge className="bg-amber-500/15 text-amber-400">Тест</Badge>
                )}
                <span className="text-muted">
                  {o.name ?? 'удалённый аккаунт'}
                  {o.username && ` @${o.username}`}
                </span>
                <span className="text-muted w-full text-xs">
                  {formatDate(o.createdAt)}
                  {o.paidAt && ` · оплачен ${formatDate(o.paidAt)}`}
                  {o.refundedAt && ` · возврат ${formatDate(o.refundedAt)}`}
                  {` · ${o.provider}`}
                  {o.providerRef && ` · ${o.providerRef}`}
                </span>
                {(o.refundReason || o.failureReason) && (
                  <span className="text-muted w-full text-xs">
                    {o.refundReason ?? o.failureReason}
                  </span>
                )}
                {o.status === 'paid' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    disabled={pending}
                    onClick={() => void refund(o)}
                  >
                    <RotateCcw className="size-4" /> Возврат
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Prices per plan and period (owner). An inactive price is a draft: only the test checkout uses it.
export function PaymentPrices({ initial, canEdit }: { initial: AdminPrice[]; canEdit: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {(['plus', 'vip'] as const).flatMap((plan) =>
        MONTHS.map((m) => (
          <PriceRow
            key={`${plan}:${m}`}
            plan={plan}
            months={m}
            price={initial.find((p) => p.plan === plan && p.periodMonths === m) ?? null}
            canEdit={canEdit}
          />
        )),
      )}
    </ul>
  )
}

function PriceRow({
  plan,
  months,
  price,
  canEdit,
}: {
  plan: 'plus' | 'vip'
  months: 1 | 3 | 12
  price: AdminPrice | null
  canEdit: boolean
}) {
  const { pending, error, run } = useAdminAction()
  const [amount, setAmount] = useState(price ? (price.amountSen / 100).toFixed(2) : '')
  const [active, setActive] = useState(price?.active ?? false)
  const [ref, setRef] = useState(price?.providerPriceId ?? '')
  const [saved, setSaved] = useState(false)
  const id = `price-${plan}-${months}`

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const value = amount.trim() === '' ? null : Number(amount.replace(',', '.'))
    const what =
      value === null
        ? 'удалить цену'
        : `RM ${value.toFixed(2)}${active ? ' (активна: видна и списывается, когда оплата включена)' : ' (черновик)'}`
    if (!confirm(`${PLAN_LABELS[plan]}, ${monthsLabel(months)}: ${what}?`)) return
    setSaved(false)
    const r = await run(() =>
      setPrice({
        plan,
        periodMonths: months,
        amountRm: value,
        active,
        providerPriceId: ref.trim() || null,
      }),
    )
    if (r.ok) setSaved(true)
  }

  return (
    <li className="bg-surface flex flex-col gap-2 rounded-2xl px-4 py-3">
      <form onSubmit={save} className="flex flex-wrap items-end gap-3" noValidate>
        <span className="w-28 font-medium">
          {PLAN_LABELS[plan]} · {monthsLabel(months)}
        </span>
        <Field label="Цена, RM" htmlFor={id} className="w-32">
          <Input
            id={id}
            inputMode="decimal"
            value={amount}
            disabled={!canEdit}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="нет цены"
          />
        </Field>
        <Field
          label="ID цены в платёжной системе"
          htmlFor={`${id}-ref`}
          className="min-w-40 flex-1"
        >
          <Input
            id={`${id}-ref`}
            value={ref}
            disabled={!canEdit}
            onChange={(e) => setRef(e.target.value)}
            maxLength={200}
            placeholder="необязательно"
          />
        </Field>
        <Chip selected={active} disabled={!canEdit} onClick={() => setActive((v) => !v)}>
          {active ? 'Активна' : 'Черновик'}
        </Chip>
        {canEdit && (
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            <Save className="size-4" /> Сохранить
          </Button>
        )}
      </form>
      <FormError message={error} />
      {saved && <p className="text-xs text-emerald-400">Сохранено</p>}
    </li>
  )
}
