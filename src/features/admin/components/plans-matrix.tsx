'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { setFeature, setLimit } from '../plans-actions'
import { PERIOD_LABELS, PLAN_LABELS } from '../plans-labels'
import { LIMIT_PERIODS, PLAN_LEVELS, type LimitPeriod, type PlanLevel } from '../plans-schemas'
import type { PlanFeature } from '../queries/plans'
import { Badge } from './badges'
import { useAdminAction } from './use-admin-action'

const selectClass = 'bg-background border-border h-12 rounded-2xl border px-3 text-sm'

// The matrix: one card per feature (works on phones), with the enable switch, the lowest plan
// and, per plan that has the feature, a quota (empty = unlimited) and its period.
export function PlansMatrix({ features }: { features: PlanFeature[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {features.map((f) => (
        <FeatureCard key={f.key} feature={f} />
      ))}
    </ul>
  )
}

function FeatureCard({ feature }: { feature: PlanFeature }) {
  const { pending, error, run } = useAdminAction()
  const [notice, setNotice] = useState<string>()
  const [minPlan, setMinPlan] = useState<PlanLevel>(feature.minPlan)
  const [note, setNote] = useState(feature.note ?? '')
  const dirty = minPlan !== feature.minPlan || note.trim() !== (feature.note ?? '')
  // Limits are shown for features that have quota rows (likes, blind dates, boost, crush...).
  const hasLimits = Object.keys(feature.limits).length > 0

  const save = async (enabled: boolean) => {
    setNotice(undefined)
    const r = await run(() =>
      setFeature({ key: feature.key, enabled, minPlan, note: note.trim() || null }),
    )
    if (r.ok) setNotice('Сохранено')
  }

  const toggle = () => {
    const q = feature.enabled
      ? `Выключить «${feature.nameRu}» для всех, кроме команды?`
      : `Включить «${feature.nameRu}»?`
    if (confirm(q)) void save(!feature.enabled)
  }

  return (
    <li
      className={`bg-surface flex flex-col gap-3 rounded-2xl px-4 py-3 ${feature.enabled ? '' : 'opacity-80'}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{feature.nameRu}</span>
            {!feature.enabled && <Badge className="bg-red-500/15 text-red-400">Выключено</Badge>}
          </div>
          <span className="text-muted font-mono text-xs">{feature.key}</span>
        </div>
        <Switch
          checked={feature.enabled}
          onToggle={toggle}
          disabled={pending}
          label={`Включить ${feature.nameRu}`}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">С плана</span>
          <select
            value={minPlan}
            onChange={(e) => setMinPlan(e.target.value as PlanLevel)}
            className={selectClass}
            disabled={pending}
          >
            {PLAN_LEVELS.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted">Заметка</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Необязательно"
            disabled={pending}
          />
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty}
          loading={pending && dirty}
          onClick={() => void save(feature.enabled)}
        >
          <Save className="size-4" /> Сохранить
        </Button>
      </div>
      {hasLimits && (
        <div className="grid gap-2 sm:grid-cols-3">
          {PLAN_LEVELS.map((p) => (
            <LimitEditor
              key={p}
              featureKey={feature.key}
              plan={p}
              available={PLAN_LEVELS.indexOf(p) >= PLAN_LEVELS.indexOf(feature.minPlan)}
              limit={feature.limits[p]?.limit ?? null}
              period={feature.limits[p]?.period ?? null}
            />
          ))}
        </div>
      )}
      <FormError message={error} />
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
    </li>
  )
}

function LimitEditor({
  featureKey,
  plan,
  available,
  limit,
  period,
}: {
  featureKey: string
  plan: PlanLevel
  available: boolean
  limit: number | null
  period: LimitPeriod | null
}) {
  const { pending, error, run } = useAdminAction()
  const [value, setValue] = useState(limit === null ? '' : String(limit))
  const [per, setPer] = useState<LimitPeriod | ''>(period ?? '')
  const [saved, setSaved] = useState(false)
  const dirty = value.trim() !== (limit === null ? '' : String(limit)) || per !== (period ?? '')

  const save = async () => {
    setSaved(false)
    const v = value.trim() === '' ? null : Number(value)
    const r = await run(() =>
      setLimit({ key: featureKey, plan, value: v, period: per === '' ? null : per }),
    )
    if (r.ok) setSaved(true)
  }

  return (
    <div className="bg-background flex flex-col gap-2 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{PLAN_LABELS[plan]}</span>
        {!available && <span className="text-muted text-xs">нет доступа</span>}
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Без лимита"
          aria-label={`Лимит ${PLAN_LABELS[plan]}`}
          className="min-w-0 flex-1"
          disabled={pending}
        />
        <select
          value={per}
          onChange={(e) => setPer(e.target.value as LimitPeriod | '')}
          aria-label={`Период ${PLAN_LABELS[plan]}`}
          className={`${selectClass} min-w-0 flex-1`}
          disabled={pending}
        >
          <option value="">без периода</option>
          {LIMIT_PERIODS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      {dirty && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => void save()}>
          Сохранить лимит
        </Button>
      )}
      <FormError message={error} />
      {saved && !dirty && <p className="text-xs text-emerald-400">Сохранено</p>}
    </div>
  )
}
