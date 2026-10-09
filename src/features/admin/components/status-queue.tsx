'use client'

import Link from 'next/link'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FLAG_LABELS, type FlagKind } from '../report-labels'
import type { AdminStatus } from '../queries/statuses'
import { moderateStatus } from '../status-actions'
import { Badge, BannedBadge, formatDate } from './badges'
import { useModeration } from './use-moderation'

const STATE_LABELS: Record<AdminStatus['state'], { label: string; className: string }> = {
  visible: { label: 'Виден', className: 'bg-emerald-500/15 text-emerald-400' },
  held: { label: 'На проверке', className: 'bg-amber-500/15 text-amber-400' },
  removed: { label: 'Удалён', className: 'bg-red-500/15 text-red-400' },
}

const kindLabel = (k: string) =>
  k in FLAG_LABELS ? FLAG_LABELS[k as FlagKind] : k === 'error' ? 'Ошибка проверки' : k

// Live statuses for review: approve (held -> visible) or remove. Both close the open reports on
// the status and are logged.
export function StatusQueue({ statuses, canDecide }: { statuses: AdminStatus[]; canDecide: boolean }) {
  const { pending, error, run } = useModeration()

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="flex flex-col gap-2">
        {statuses.map((s) => {
          const state = STATE_LABELS[s.state]
          const live = s.state !== 'removed' && !s.replacedAt && new Date(s.expiresAt) > new Date()
          return (
            <li key={s.id} className="bg-surface flex flex-col gap-2 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className={state.className}>{state.label}</Badge>
                {s.heldKinds.map((k) => (
                  <Badge key={k} className="bg-amber-500/15 text-amber-400">
                    {kindLabel(k)}
                  </Badge>
                ))}
                {s.openReports > 0 && (
                  <Badge className="bg-red-500/15 text-red-400">Жалоб: {s.openReports}</Badge>
                )}
                {s.banned && <BannedBadge />}
                <span className="text-muted">
                  {formatDate(s.createdAt)} · {live ? `до ${formatDate(s.expiresAt)}` : 'не активен'}
                </span>
              </div>
              <p className="text-lg break-words">
                <span aria-hidden className="mr-2">
                  {s.emoji}
                </span>
                {s.text}
              </p>
              <p className="text-sm">
                <span className="text-muted">Автор: </span>
                <Link href={`/admin/users/${s.userId}`} className="font-medium hover:underline">
                  {s.name}
                  {s.username ? ` (@${s.username})` : ''}
                </Link>
              </p>
              {s.reviewedAt && (
                <p className="text-muted text-xs">Решение принято {formatDate(s.reviewedAt)}</p>
              )}
              {canDecide && (
                <div className="flex flex-wrap gap-2">
                  {s.state !== 'visible' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => void run(() => moderateStatus({ id: s.id, decision: 'approve' }))}
                    >
                      <Check className="size-4" /> Одобрить
                    </Button>
                  )}
                  {s.state !== 'removed' && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt('Причина удаления (необязательно)')
                        if (reason === null) return
                        void run(() => moderateStatus({ id: s.id, decision: 'remove', reason }))
                      }}
                    >
                      <Trash2 className="size-4" /> Удалить
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
