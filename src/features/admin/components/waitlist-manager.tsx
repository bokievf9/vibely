'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import type { WaitlistEntry, WaitlistStatus } from '../queries/waitlist'
import { exportWaitlist, markWaitlistInvited } from '../waitlist-actions'
import { formatDate } from './badges'
import { downloadText, useAdminAction } from './use-admin-action'

const LOCALE_LABELS: Record<string, string> = { en: 'EN', ms: 'MS', ru: 'RU' }

// Masked list for everyone in the panel; admins and owners also get the CSV export (full numbers,
// logged) and "mark invited" (logged per entry).
export function WaitlistManager({
  entries,
  status,
  canManage,
  cityLabels,
}: {
  entries: WaitlistEntry[]
  status: WaitlistStatus
  canManage: boolean
  cityLabels: Record<string, string>
}) {
  const router = useRouter()
  const { pending, error, run } = useAdminAction()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string>()
  const selectable = entries.filter((e) => !e.invitedAt)

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={async () => {
              const result = await run(() => exportWaitlist({ status }))
              if (result.ok)
                downloadText(result.data.filename, result.data.csv, 'text/csv;charset=utf-8')
            }}
          >
            <FileDown className="size-4" /> Скачать CSV (полные номера)
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            loading={pending}
            onClick={async () => {
              const result = await run(() => markWaitlistInvited({ ids: [...selected] }))
              if (result.ok) {
                setNotice(`Отмечено приглашёнными: ${result.data}`)
                setSelected(new Set())
                router.refresh()
              }
            }}
          >
            <Send className="size-4" /> Отметить приглашёнными ({selected.size})
          </Button>
        </div>
      )}
      <FormError message={error} />
      {notice && <p className="text-success text-sm">{notice}</p>}
      {entries.length === 0 ? (
        <p className="text-muted bg-surface rounded-2xl px-4 py-6 text-center text-sm">
          В этом списке пока никого нет.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                {canManage && (
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Выбрать всех неприглашённых на странице"
                      className="accent-accent size-4"
                      checked={selectable.length > 0 && selected.size === selectable.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(selectable.map((x) => x.id)) : new Set(),
                        )
                      }
                    />
                  </th>
                )}
                <th className="px-3 py-2.5 font-medium">Номер</th>
                <th className="px-3 py-2.5 font-medium">Город</th>
                <th className="px-3 py-2.5 font-medium">Язык</th>
                <th className="px-3 py-2.5 font-medium">Откуда</th>
                <th className="px-3 py-2.5 font-medium">Записался</th>
                <th className="px-3 py-2.5 font-medium">Приглашён</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="even:bg-white/[0.025]">
                  {canManage && (
                    <td className="px-3 py-2.5">
                      {!e.invitedAt && (
                        <input
                          type="checkbox"
                          aria-label={`Выбрать ${e.phoneMasked}`}
                          className="accent-accent size-4"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 font-medium tabular-nums">{e.phoneMasked}</td>
                  <td className="px-3 py-2.5">
                    {e.city ? (
                      (cityLabels[e.city] ?? e.city)
                    ) : (
                      <span className="text-muted">не указан</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{LOCALE_LABELS[e.locale] ?? e.locale}</td>
                  <td className="text-muted px-3 py-2.5">{e.source}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatDate(e.createdAt)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {e.invitedAt ? (
                      formatDate(e.invitedAt)
                    ) : (
                      <span className="text-muted">нет</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
