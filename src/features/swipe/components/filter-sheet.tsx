'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { GenderPicker } from '@/features/profile/components/gender-picker'
import { AGE_MAX, AGE_MIN, DISTANCE_MAX_KM, type SwipeFilters } from '../schemas'

type Props = {
  open: boolean
  value: SwipeFilters
  onClose: () => void
  onApply: (f: SwipeFilters) => void
}

const range = 'accent-accent h-2 w-full cursor-pointer'

export function FilterSheet({ open, value, onClose, onApply }: Props) {
  const { dict } = useI18n()
  const [draft, setDraft] = useState(value)
  const set = (patch: Partial<SwipeFilters>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Modal open={open} onClose={onClose} title={dict.swipe.filters}>
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted mb-2 text-sm font-medium">{dict.swipe.showMe}</legend>
          <GenderPicker multiple value={draft.genders} onChange={(genders) => set({ genders })} />
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted mb-2 text-sm font-medium">
            {fmt(dict.swipe.age, { min: draft.minAge, max: draft.maxAge })}
          </legend>
          <input
            type="range"
            aria-label="min"
            className={range}
            min={AGE_MIN}
            max={AGE_MAX}
            value={draft.minAge}
            onChange={(e) => set({ minAge: Math.min(Number(e.target.value), draft.maxAge) })}
          />
          <input
            type="range"
            aria-label="max"
            className={range}
            min={AGE_MIN}
            max={AGE_MAX}
            value={draft.maxAge}
            onChange={(e) => set({ maxAge: Math.max(Number(e.target.value), draft.minAge) })}
          />
        </fieldset>
        <label className="flex flex-col gap-2">
          <span className="text-muted text-sm font-medium">
            {fmt(dict.swipe.distance, { km: draft.maxKm })}
          </span>
          <input
            type="range"
            className={range}
            min={1}
            max={DISTANCE_MAX_KM}
            value={draft.maxKm}
            onChange={(e) => set({ maxKm: Number(e.target.value) })}
          />
        </label>
        <Button fullWidth disabled={!draft.genders.length} onClick={() => onApply(draft)}>
          {dict.swipe.apply}
        </Button>
      </div>
    </Modal>
  )
}
