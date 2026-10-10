'use client'

import { useState } from 'react'
import { CalendarPlus, Pencil, Repeat, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'
import { cancelEvent, saveEvent } from '../event-actions'
import { formatMalaysia } from '../event-time'
import type { EventFormInput } from '../event-schemas'
import type { AdminEvent } from '../queries/events'
import { hasRole, type AdminRole } from '../roles'
import { useAdminAction } from './use-admin-action'

const STATUS_LABELS: Record<Enums<'event_status'>, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  live: 'Идёт сейчас',
  ended: 'Завершён',
  cancelled: 'Отменён',
}

const STATUS_CLASS: Record<Enums<'event_status'>, string> = {
  draft: 'bg-white/10 text-muted',
  scheduled: 'bg-verified/15 text-verified',
  live: 'bg-accent/15 text-accent',
  ended: 'bg-white/10 text-muted',
  cancelled: 'bg-danger/15 text-danger',
}

const EMPTY: EventFormInput = {
  id: null,
  titleEn: '',
  titleMs: '',
  titleRu: '',
  theme: '',
  date: '',
  startTime: '21:00',
  endTime: '23:00',
  weekly: false,
  draft: false,
}

const isOver = (e: AdminEvent) => e.status === 'ended' || e.status === 'cancelled'

// Blind Dating Nights: the list with stats, a create/edit form (Malaysia time) and cancel.
// Viewers see the list only; writing needs the admin role (the RPCs check again).
export function EventsManager({ events, role }: { events: AdminEvent[]; role: AdminRole }) {
  const canWrite = hasRole(role, 'admin')
  const { pending, error, run } = useAdminAction()
  const [form, setForm] = useState<EventFormInput | null>(null)

  const edit = (e: AdminEvent) =>
    setForm({
      id: e.id,
      titleEn: e.titleEn,
      titleMs: e.titleMs,
      titleRu: e.titleRu,
      theme: e.theme ?? '',
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      weekly: e.weekly,
      draft: e.status === 'draft',
    })

  const submit = async () => {
    if (!form) return
    const result = await run(() => saveEvent(form))
    if (result.ok) setForm(null)
  }

  const cancel = (e: AdminEvent) => {
    const reason = prompt(`Отменить «${e.titleRu}»? Причина (необязательно):`)
    if (reason === null) return
    void run(() => cancelEvent({ id: e.id, reason }))
  }

  const upcoming = events.filter((e) => !isOver(e))
  const past = events.filter(isOver)

  return (
    <div className="flex flex-col gap-5">
      {canWrite && !form && (
        <Button className="self-start" onClick={() => setForm(EMPTY)}>
          <CalendarPlus className="size-5" /> Новый вечер
        </Button>
      )}

      {form && (
        <section className="bg-surface flex flex-col gap-4 rounded-2xl p-4">
          <h2 className="font-semibold">{form.id ? 'Изменить вечер' : 'Новый вечер'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Название (EN)" htmlFor="ev-en">
              <Input
                id="ev-en"
                value={form.titleEn}
                maxLength={80}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
            </Field>
            <Field label="Название (MS)" htmlFor="ev-ms">
              <Input
                id="ev-ms"
                value={form.titleMs}
                maxLength={80}
                onChange={(e) => setForm({ ...form, titleMs: e.target.value })}
              />
            </Field>
            <Field label="Название (RU)" htmlFor="ev-ru">
              <Input
                id="ev-ru"
                value={form.titleRu}
                maxLength={80}
                onChange={(e) => setForm({ ...form, titleRu: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Тема (необязательно, одна для всех языков)"
            htmlFor="ev-theme"
            hint="Например: Coffee lovers, K-drama night"
          >
            <Input
              id="ev-theme"
              value={form.theme}
              maxLength={120}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Дата (время Малайзии)" htmlFor="ev-date">
              <Input
                id="ev-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Начало" htmlFor="ev-start">
              <Input
                id="ev-start"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </Field>
            <Field
              label="Окончание"
              htmlFor="ev-end"
              hint="Раньше начала = на следующий день (22:00 - 01:00)"
            >
              <Input
                id="ev-end"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-accent size-4"
                checked={form.weekly}
                onChange={(e) => setForm({ ...form, weekly: e.target.checked })}
              />
              Повторять каждую неделю
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-accent size-4"
                checked={form.draft}
                onChange={(e) => setForm({ ...form, draft: e.target.checked })}
              />
              Черновик (не показывать пользователям)
            </label>
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button loading={pending} onClick={submit}>
              {form.id ? 'Сохранить' : 'Создать'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setForm(null)}>
              Отмена
            </Button>
          </div>
        </section>
      )}

      {!form && <FormError message={error} />}

      <EventList
        title="Ближайшие и текущие"
        events={upcoming}
        empty="Нет запланированных вечеров."
        canWrite={canWrite}
        pending={pending}
        onEdit={edit}
        onCancel={cancel}
      />
      <EventList title="Прошедшие" events={past} empty="Пока ничего не прошло." />
    </div>
  )
}

function EventList({
  title,
  events,
  empty,
  canWrite = false,
  pending = false,
  onEdit,
  onCancel,
}: {
  title: string
  events: AdminEvent[]
  empty: string
  canWrite?: boolean
  pending?: boolean
  onEdit?: (e: AdminEvent) => void
  onCancel?: (e: AdminEvent) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{title}</h2>
      {events.length === 0 && <p className="text-muted text-sm">{empty}</p>}
      <ul className="flex flex-col gap-2">
        {events.map((e) => (
          <li key={e.id} className="bg-surface flex flex-col gap-2 rounded-2xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  STATUS_CLASS[e.status],
                )}
              >
                {STATUS_LABELS[e.status]}
              </span>
              <span className="font-medium">{e.titleRu}</span>
              <span className="text-muted text-sm">
                {e.titleEn} · {e.titleMs}
              </span>
              {e.weekly && (
                <span className="text-muted flex items-center gap-1 text-xs">
                  <Repeat className="size-3.5" aria-hidden /> еженедельно
                </span>
              )}
            </div>
            <p className="text-sm">
              {formatMalaysia(e.startsAt)} -{' '}
              {formatMalaysia(e.endsAt, { weekday: undefined, day: undefined, month: undefined })}{' '}
              MYT
              {e.theme && <span className="text-muted"> · {e.theme}</span>}
            </p>
            <dl className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
              {e.status === 'live' && <Stat label="в комнате" value={e.stats.inRoom} />}
              <Stat label="зашли" value={e.stats.joined} />
              <Stat label="пар" value={e.stats.pairs} />
              <Stat label="мэтчей" value={e.stats.matches} />
              <Stat label="напоминаний" value={e.stats.reminders} />
            </dl>
            {canWrite && onEdit && onCancel && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => onEdit(e)}>
                  <Pencil className="size-4" /> Изменить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  disabled={pending}
                  onClick={() => onCancel(e)}
                >
                  <XCircle className="size-4" /> Отменить
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-1">
      <dt>{label}:</dt>
      <dd className="text-foreground font-medium">{value}</dd>
    </div>
  )
}
