'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { bulkDismiss } from '../report-actions'
import type { ReportCase } from '../queries/reports'
import { hasRole, type AdminRole } from '../roles'
import { ReportCard } from './report-card'
import { useModeration } from './use-moderation'

const keyOf = (c: Pick<ReportCase, 'targetType' | 'targetId'>) => `${c.targetType}:${c.targetId}`

// The page of cases with multi-select: "Dismiss selected" closes each case on its own (each one
// is logged); cases taken by another moderator are skipped.
export function ReportQueue({ cases, role }: { cases: ReportCase[]; role: AdminRole }) {
  const canAct = hasRole(role, 'moderator')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string>()
  const { pending, error, run } = useModeration()
  const selectable = (canAct ? cases : []).filter(
    (c) => !(c.status === 'in_review' && !c.claimedBy?.me),
  )
  // Cases resolved meanwhile drop out of the page: keep only what is still listed.
  const chosen = selectable.filter((c) => selected.has(keyOf(c)))

  const toggle = (c: ReportCase, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(keyOf(c))
      else next.delete(keyOf(c))
      return next
    })

  const dismissSelected = () =>
    run(async () => {
      const result = await bulkDismiss({
        cases: chosen.map(({ targetType, targetId }) => ({ targetType, targetId })),
      })
      if (result.ok) {
        setSelected(new Set())
        setNotice(
          `Отклонено: ${result.data.dismissed}` +
            (result.data.skipped ? `, пропущено: ${result.data.skipped}` : ''),
        )
        return { ok: true, data: undefined }
      }
      return result
    })

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent size-5"
            checked={chosen.length > 0 && chosen.length === selectable.length}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(selectable.map(keyOf)) : new Set())
            }
          />
          Выбрать все на странице
        </label>
        {notice && <span className="text-muted">{notice}</span>}
      </div>
      <ul className="flex flex-col gap-4">
        {cases.map((c) => (
          <li key={keyOf(c)}>
            <ReportCard
              group={c}
              role={role}
              selected={selected.has(keyOf(c))}
              onSelect={selectable.includes(c) ? (on) => toggle(c, on) : undefined}
            />
          </li>
        ))}
      </ul>
      {chosen.length > 0 && (
        <div className="bg-background/95 border-border sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <span className="text-sm font-medium">Выбрано: {chosen.length}</span>
          <Button size="sm" variant="secondary" loading={pending} onClick={dismissSelected}>
            <X className="size-4" /> Отклонить выбранные
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setSelected(new Set())}
          >
            Снять выбор
          </Button>
          <FormError message={error} />
        </div>
      )}
    </>
  )
}
