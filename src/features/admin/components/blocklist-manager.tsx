'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { blockPhone, unblockPhone } from '../blocklist-actions'
import type { BlockedPhone } from '../queries/team'
import { formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

export function BlocklistManager({ entries }: { entries: BlockedPhone[] }) {
  const { pending, error, run } = useAdminAction()
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')

  const add = async () => {
    const result = await run(() => blockPhone({ phone, reason }))
    if (result.ok) {
      setPhone('')
      setReason('')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-surface flex flex-col gap-3 rounded-2xl p-4">
        <h2 className="font-semibold">Заблокировать номер</h2>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="+60 12 345 6789"
          aria-label="Номер телефона"
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Причина"
          aria-label="Причина"
        />
        <Button
          className="self-start"
          disabled={phone.trim().length < 8}
          loading={pending}
          onClick={add}
        >
          Добавить в блок-лист
        </Button>
      </section>
      <FormError message={error} />
      {!entries.length ? (
        <p className="text-muted">Блок-лист пуст</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((b) => (
            <li
              key={b.id}
              className="bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3 text-sm"
            >
              <span className="font-medium tabular-nums">{b.phone}</span>
              {b.reason && <span className="text-muted">{b.reason}</span>}
              {b.userId && (
                <Link href={`/admin/users/${b.userId}`} className="text-accent hover:underline">
                  аккаунт
                </Link>
              )}
              <span className="text-muted text-xs">{formatDate(b.createdAt)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Убрать ${b.phone} из блок-листа?`))
                    run(() => unblockPhone({ id: b.id }))
                }}
              >
                Разблокировать
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
