'use client'

import { useState, type FormEvent } from 'react'
import { Ban, Gift, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { grantPlan, lookupUserPlan, revokeGrant, type UserPlan } from '../plans-actions'
import { PLAN_LABELS, sourceLabel } from '../plans-labels'
import { Badge, formatDate } from './badges'
import { useAdminAction } from './use-admin-action'

// Find a user, see their plan and grants, grant Plus/VIP for N days (or without end), revoke.
export function PlansGrants() {
  const { pending, error, setError, run } = useAdminAction()
  const [query, setQuery] = useState('')
  const [user, setUser] = useState<UserPlan | null>(null)
  const [plan, setPlan] = useState<'plus' | 'vip'>('plus')
  const [days, setDays] = useState('30')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string>()

  const find = async (e: FormEvent) => {
    e.preventDefault()
    setNotice(undefined)
    const r = await run(() => lookupUserPlan({ query }))
    setUser(r.ok ? r.data : null)
  }

  const grant = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const d = days.trim() === '' ? null : Number(days)
    const what = `${PLAN_LABELS[plan]} ${d ? `на ${d} дн.` : 'без срока'}`
    if (!confirm(`Выдать ${what} пользователю ${user.name}?`)) return
    setNotice(undefined)
    const r = await run(() =>
      grantPlan({ userId: user.userId, plan, days: d, note: note.trim() || null }),
    )
    if (r.ok) {
      setUser(r.data)
      setNote('')
      setNotice(`Выдано: ${what}`)
    }
  }

  const revoke = async (id: string) => {
    if (!user || !confirm('Отозвать эту выдачу? План пересчитается сразу.')) return
    setNotice(undefined)
    const r = await run(() => revokeGrant({ id, userId: user.userId }))
    if (r.ok) {
      setUser(r.data)
      setNotice('Выдача отозвана')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={find} className="flex flex-wrap gap-2" noValidate>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setError(undefined)
          }}
          placeholder="@username, телефон или id"
          aria-label="Пользователь"
          autoComplete="off"
          className="min-w-56 flex-1"
        />
        <Button type="submit" variant="secondary" loading={pending && !user}>
          <Search className="size-4" /> Найти
        </Button>
      </form>
      <FormError message={error} />
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      {user && (
        <div className="bg-surface flex flex-col gap-4 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{user.name}</span>
            {user.username && <span className="text-muted text-sm">@{user.username}</span>}
            <Badge className="bg-accent/15 text-accent">{PLAN_LABELS[user.plan]}</Badge>
            {user.isStaff && (
              <Badge className="bg-emerald-500/15 text-emerald-400">Команда: всё без лимитов</Badge>
            )}
            <span className="text-muted text-sm">
              {user.plan === 'free'
                ? 'без платного плана'
                : user.planUntil
                  ? `до ${formatDate(user.planUntil)}`
                  : 'без срока'}
            </span>
          </div>

          <form onSubmit={grant} className="flex flex-col gap-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="План">
                <div className="flex gap-2" role="group" aria-label="План">
                  {(['plus', 'vip'] as const).map((p) => (
                    <Chip key={p} selected={plan === p} onClick={() => setPlan(p)}>
                      {PLAN_LABELS[p]}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Дней" htmlFor="grant-days" hint="Пусто: без срока">
                <Input
                  id="grant-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="Без срока"
                />
              </Field>
              <Field label="Заметка" htmlFor="grant-note" hint="Видна в журнале">
                <Input
                  id="grant-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="Например: победитель конкурса"
                />
              </Field>
            </div>
            <Button type="submit" className="self-start" loading={pending}>
              <Gift className="size-4" /> Выдать план
            </Button>
            <p className="text-muted text-xs">
              Новая выдача начинается, когда закончится текущая того же или более высокого плана.
            </p>
          </form>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Выдачи</h3>
            {user.grants.length === 0 ? (
              <p className="text-muted text-sm">Выдач нет</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {user.grants.map((g) => (
                  <li
                    key={g.id}
                    className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{PLAN_LABELS[g.plan]}</span>
                    <span className="text-muted">{sourceLabel(g.source)}</span>
                    <span>
                      {formatDate(g.startsAt)}: {g.endsAt ? formatDate(g.endsAt) : 'без срока'}
                    </span>
                    {g.revokedAt ? (
                      <Badge className="bg-red-500/15 text-red-400">Отозвано</Badge>
                    ) : g.active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400">Действует</Badge>
                    ) : g.endsAt && new Date(g.endsAt) <= new Date() ? (
                      <Badge className="bg-border text-muted">Истекло</Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-400">В очереди</Badge>
                    )}
                    {g.note && <span className="text-muted w-full text-xs">{g.note}</span>}
                    {!g.revokedAt && (g.active || !g.endsAt || new Date(g.endsAt) > new Date()) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        disabled={pending}
                        onClick={() => void revoke(g.id)}
                      >
                        <Ban className="size-4" /> Отозвать
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
