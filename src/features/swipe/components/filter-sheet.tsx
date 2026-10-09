'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { GenderPicker } from '@/features/profile/components/gender-picker'
import { AGE_MAX, AGE_MIN, DISTANCE_MAX_KM, type SwipeFilters } from '../schemas'
import { RangeSlider } from '@/components/ui/range-slider'
import { Switch } from '@/components/ui/switch'

type Props = {
  open: boolean
  value: SwipeFilters
  onClose: () => void
  onApply: (f: SwipeFilters) => void
  // Plans exist on this database (migration 20261009000200): offer "Similar plans first".
  plansAvailable?: boolean
}

export function FilterSheet({ open, value, onClose, onApply, plansAvailable }: Props) {
  const { dict } = useI18n()
  const t = dict.discoverui
  const [draft, setDraft] = useState(value)
  const set = (patch: Partial<SwipeFilters>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Modal open={open} onClose={onClose} title={dict.swipe.filters}>
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted mb-2 text-sm font-medium">{dict.swipe.showMe}</legend>
          <GenderPicker multiple value={draft.genders} onChange={(genders) => set({ genders })} />
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 flex w-full justify-between text-sm font-medium">
            <span className="text-muted">{t.ageLabel}</span>
            <span className="tabular-nums">
              {draft.minAge}-{draft.maxAge}
            </span>
          </legend>
          <RangeSlider
            min={AGE_MIN}
            max={AGE_MAX}
            values={[draft.minAge, draft.maxAge]}
            onChange={([minAge, maxAge]) => set({ minAge, maxAge })}
            labels={[t.minAge, t.maxAge]}
            valueText={(age) => fmt(t.ageValue, { age })}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 flex w-full justify-between text-sm font-medium">
            <span className="text-muted">{t.maxDistance}</span>
            <span className="tabular-nums">{fmt(t.kmValue, { km: draft.maxKm })}</span>
          </legend>
          <RangeSlider
            min={1}
            max={DISTANCE_MAX_KM}
            values={[draft.maxKm]}
            onChange={([maxKm]) => set({ maxKm })}
            labels={[t.maxDistance]}
            valueText={(km) => fmt(t.kmValue, { km })}
          />
        </fieldset>
        {plansAvailable && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{dict.plans.filter}</span>
              <Switch
                checked={Boolean(draft.similarPlans)}
                onToggle={() => set({ similarPlans: !draft.similarPlans })}
                label={dict.plans.filter}
              />
            </div>
            <p className="text-muted text-sm">{dict.plans.filterHint}</p>
          </div>
        )}
        <Button fullWidth disabled={!draft.genders.length} onClick={() => onApply(draft)}>
          {dict.swipe.apply}
        </Button>
      </div>
    </Modal>
  )
}
