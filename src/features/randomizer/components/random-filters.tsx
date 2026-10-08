'use client'

import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { RangeSlider } from '@/components/ui/range-slider'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { GenderPicker } from '@/features/profile/components/gender-picker'
import { TagPicker } from '@/features/profile/components/tag-picker'
import type { Tag } from '@/features/profile/queries'
import type { JoinFilters } from '../schemas'
import { SearchingNow } from './searching-now'

type Props = {
  tags: Tag[]
  initial: JoinFilters
  pending: boolean
  error?: string
  onStart: (f: JoinFilters) => void
}

export function RandomFilters({ tags, initial, pending, error, onStart }: Props) {
  const { dict } = useI18n()
  const [f, setF] = useState(initial)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">{dict.random.intro}</p>
      <SearchingNow />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-2 text-sm font-medium">{dict.random.lookingFor}</legend>
        <GenderPicker multiple value={f.genders} onChange={(genders) => setF({ ...f, genders })} />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-2 text-sm font-medium">
          {fmt(dict.random.age, { min: f.minAge, max: f.maxAge })}
        </legend>
        <RangeSlider
          min={18}
          max={99}
          values={[f.minAge, f.maxAge]}
          onChange={([minAge = f.minAge, maxAge = f.maxAge]) => setF({ ...f, minAge, maxAge })}
          labels={[dict.flows.random.minAge, dict.flows.random.maxAge]}
          valueText={(age) => String(age)}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-2 text-sm font-medium">{dict.random.tags}</legend>
        <TagPicker tags={tags} value={f.tagIds} onChange={(tagIds) => setF({ ...f, tagIds })} />
      </fieldset>
      <FormError message={error} />
      <Button fullWidth loading={pending} disabled={!f.genders.length} onClick={() => onStart(f)}>
        <Shuffle className="size-5" /> {dict.random.start}
      </Button>
    </div>
  )
}
