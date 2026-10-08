'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { decideAppeal } from '../appeal-actions'
import { readableBan } from '../labels'
import type { AppealRow } from '../queries/appeals'
import { hasRole, type AdminRole } from '../roles'
import { formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

const STATUS: Record<string, string> = {
  open: 'Ждёт решения',
  accepted: 'Принята, бан снят',
  rejected: 'Отклонена',
}

export function AppealCard({ appeal: a, role }: { appeal: AppealRow; role: AdminRole }) {
  const { pending, error, run } = useAdminAction()
  const [note, setNote] = useState('')
  const open = a.status === 'open'

  return (
    <article className="bg-surface flex flex-col gap-3 rounded-2xl p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/admin/users/${a.userId}`} className="font-semibold hover:underline">
          {a.userName}
        </Link>
        <span className="text-muted text-sm">{formatDate(a.createdAt)}</span>
        <span className="ml-auto text-sm">{STATUS[a.status] ?? a.status}</span>
      </header>
      <p className="text-sm text-red-400">
        Блокировка: {a.sanctionReason ? readableBan(a.sanctionReason) : '—'}
        {a.sanctionAt && ` · с ${formatDate(a.sanctionAt)}`}
        {open && (a.bannedUntil ? ` · до ${formatDate(a.bannedUntil)}` : ' · бессрочно')}
      </p>
      <p className="text-sm whitespace-pre-wrap">{a.body}</p>
      {!open && (
        <p className="text-muted text-sm">
          {a.decidedBy} · {a.decidedAt && formatDate(a.decidedAt)}
          {a.decisionNote && `: ${a.decisionNote}`}
        </p>
      )}
      {open && hasRole(role, 'moderator') && (
        <>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Решение (обязательно при отказе, видно только модераторам)"
            aria-label="Решение"
            className="min-h-20"
          />
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            {hasRole(role, 'admin') && (
              <Button
                size="sm"
                loading={pending}
                onClick={() => run(() => decideAppeal({ appealId: a.id, accept: true, note }))}
              >
                <Check className="size-4" /> Принять и разблокировать
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={note.trim().length < 3}
              loading={pending}
              onClick={() => run(() => decideAppeal({ appealId: a.id, accept: false, note }))}
            >
              <X className="size-4" /> Отклонить
            </Button>
          </div>
        </>
      )}
    </article>
  )
}
