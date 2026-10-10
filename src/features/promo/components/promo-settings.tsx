'use client'

import { useState } from 'react'
import { ChevronRight, Ticket } from 'lucide-react'
import { VipBadge } from '@/components/ui/vip-badge'
import { groupedRowClassName } from '@/components/ui/grouped'
import { fmt } from '@/i18n/config'
import { formatDay } from '@/i18n/format'
import { useI18n } from '@/i18n/client'
import type { VipStatus } from '../queries'
import { PromoSheet } from './promo-sheet'

// Settings → Promo code: the current VIP state (or a hint) and a sheet to enter a code.
export function PromoSettingsRow({ initial }: { initial: VipStatus }) {
  const { dict, locale } = useI18n()
  const t = dict.promo
  const [open, setOpen] = useState(false)

  const status =
    initial.plan !== 'free' && initial.planUntil
      ? fmt(dict.plans.rowUntil, {
          plan: dict.plans.names[initial.plan],
          date: formatDay(initial.planUntil, locale),
        })
      : initial.plan !== 'free'
        ? dict.plans.names[initial.plan]
        : initial.pending > 0
          ? t.pendingHint
          : t.rowHint
  const boost = initial.boostUntil
    ? fmt(t.boostUntil, { date: formatDay(initial.boostUntil, locale) })
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={groupedRowClassName + ' text-left'}
      >
        <span className="icon-tile">
          {initial.isVip ? (
            <VipBadge size={18} />
          ) : (
            <Ticket className="size-[1.125rem]" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{t.row}</span>
          <span className="text-muted text-footnote font-normal">{status}</span>
          {boost && <span className="text-muted text-footnote font-normal">{boost}</span>}
        </span>
        <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
      </button>
      <PromoSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
