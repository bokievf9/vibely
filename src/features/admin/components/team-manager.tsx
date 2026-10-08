'use client'

import { useState } from 'react'
import { UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { TeamMember } from '../queries/team'
import { addMember, removeMember, setMemberRole } from '../role-actions'
import { ADMIN_ROLES, ROLE_HINTS, ROLE_LABELS, type AdminRole } from '../roles'
import { formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

const ROLES_DESC = [...ADMIN_ROLES].reverse()

export function TeamManager({ members, me }: { members: TeamMember[]; me: string }) {
  const { pending, error, run } = useAdminAction()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<AdminRole>('moderator')

  const add = async () => {
    const result = await run(() => addMember({ query, role }))
    if (result.ok) setQuery('')
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-surface flex flex-col gap-3 rounded-2xl p-4">
        <h2 className="font-semibold">Добавить в команду</h2>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Телефон, @username или ID пользователя"
          aria-label="Кого добавить"
          maxLength={100}
        />
        <RolePicker value={role} onChange={setRole} />
        <p className="text-muted text-sm">{ROLE_HINTS[role]}</p>
        <Button
          className="self-start"
          disabled={query.trim().length < 3}
          loading={pending}
          onClick={add}
        >
          Добавить
        </Button>
      </section>

      <FormError message={error} />

      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.userId} className="bg-surface flex flex-col gap-2 rounded-2xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{m.name}</span>
              {m.username && <span className="text-muted text-sm">@{m.username}</span>}
              <span className="text-muted text-sm">{m.phone}</span>
              {m.userId === me && <span className="text-accent text-xs">это вы</span>}
              <span className="text-muted ml-auto text-xs">с {formatDate(m.createdAt)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RolePicker
                value={m.role}
                disabled={pending}
                onChange={(r) => run(() => setMemberRole({ userId: m.userId, role: r }))}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Удалить ${m.name} из команды?`)) {
                    run(() => removeMember({ userId: m.userId }))
                  }
                }}
              >
                <UserMinus className="size-4" /> Удалить
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: AdminRole
  onChange: (role: AdminRole) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Роль">
      {ROLES_DESC.map((r) => (
        <Chip
          key={r}
          selected={value === r}
          disabled={disabled}
          onClick={() => value !== r && onChange(r)}
        >
          {ROLE_LABELS[r]}
        </Chip>
      ))}
    </div>
  )
}
