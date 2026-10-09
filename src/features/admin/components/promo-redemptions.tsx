'use client'

import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { exportPromoRedemptions } from '../promo-actions'
import type { PromoCode, PromoRedemption } from '../queries/promo'
import { Badge, formatDate } from './badges'
import { downloadText, useAdminAction } from './use-admin-action'

// One code's redemptions: masked phone, @username, time, status; CSV export (masked too).
export function PromoRedemptions({ code, rows }: { code: PromoCode; rows: PromoRedemption[] }) {
  const { pending, error, run } = useAdminAction()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-mono text-2xl font-bold">{code.code}</h1>
        <Badge
          className={code.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-border text-muted'}
        >
          {code.isActive ? 'Активен' : 'Выключен'}
        </Badge>
        <span className="text-muted text-sm">
          Использовано {code.currentUses}
          {code.maxUses !== null ? ` из ${code.maxUses}` : ''}: выдано {code.grantedCount}, ждут
          селфи {code.pendingCount}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          loading={pending}
          disabled={rows.length === 0}
          onClick={async () => {
            const result = await run(() => exportPromoRedemptions({ id: code.id }))
            if (result.ok)
              downloadText(result.data.filename, result.data.csv, 'text/csv;charset=utf-8')
          }}
        >
          <FileDown className="size-4" /> Скачать CSV
        </Button>
        <FormError message={error} />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">Код ещё никто не использовал</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.userId}
              className="bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3"
            >
              <Link
                href={`/admin/users/${r.userId}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                {r.name}
              </Link>
              {r.username && <span className="text-muted text-sm">@{r.username}</span>}
              <span className="text-muted text-sm">{r.phone}</span>
              {r.grantedAt ? (
                <Badge className="bg-emerald-500/15 text-emerald-400">Выдано</Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-400">Ждёт селфи</Badge>
              )}
              <span className="text-muted ml-auto text-xs">{formatDate(r.redeemedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
