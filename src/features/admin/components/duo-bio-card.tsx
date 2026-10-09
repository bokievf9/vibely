'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { reviewDuoBio } from '../duo-actions'
import type { HeldDuoBio } from '../group-evidence'
import { hasRole, type AdminRole } from '../roles'
import { formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

// One held duo bio: both members and the text. Moderators approve or reject (logged).
export function DuoBioCard({ bio, role }: { bio: HeldDuoBio; role: AdminRole }) {
  const { pending, error, run } = useAdminAction()
  const [reason, setReason] = useState('')
  const canAct = hasRole(role, 'moderator')
  const decide = (approve: boolean) =>
    run(() => reviewDuoBio({ teamId: bio.teamId, approve, reason: reason || undefined }))

  return (
    <article className="bg-surface flex flex-col gap-3 rounded-2xl p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {bio.members.map((m, i) => (
          <span key={m.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted">+</span>}
            <Link href={`/admin/users/${m.id}`} className="font-semibold hover:underline">
              {m.name}
            </Link>
            {m.username && <span className="text-muted text-sm">@{m.username}</span>}
          </span>
        ))}
        {bio.createdAt && (
          <span className="text-muted ml-auto text-sm">дуо с {formatDate(bio.createdAt)}</span>
        )}
      </header>
      <blockquote className="border-border rounded-xl border-l-4 bg-black/20 px-3 py-2 break-words whitespace-pre-wrap">
        {bio.bio || '—'}
      </blockquote>
      {canAct ? (
        <>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Комментарий (необязательно, виден только в журнале)"
            aria-label="Комментарий"
            className="min-h-16"
          />
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={pending} onClick={() => decide(true)}>
              <Check className="size-4" /> Одобрить
            </Button>
            <Button variant="danger" size="sm" loading={pending} onClick={() => decide(false)}>
              <X className="size-4" /> Отклонить (удалить описание)
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted text-sm">Роль «Наблюдатель»: только просмотр.</p>
      )}
    </article>
  )
}
