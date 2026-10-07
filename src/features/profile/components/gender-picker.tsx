'use client'

import { Chip } from '@/components/ui/chip'
import { useI18n } from '@/i18n/client'
import type { Enums } from '@/types/database.types'

type Gender = Enums<'gender'>
const GENDERS: Gender[] = ['female', 'male', 'other']

type Props =
  | { multiple?: false; value: Gender | undefined; onChange: (value: Gender) => void }
  | { multiple: true; value: Gender[]; onChange: (value: Gender[]) => void }

export function GenderPicker(props: Props) {
  const { dict } = useI18n()
  const isSelected = (g: Gender) => (props.multiple ? props.value.includes(g) : props.value === g)

  const toggle = (g: Gender) => {
    if (!props.multiple) return props.onChange(g)
    props.onChange(
      props.value.includes(g) ? props.value.filter((v) => v !== g) : [...props.value, g],
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {GENDERS.map((g) => (
        <Chip key={g} selected={isSelected(g)} onClick={() => toggle(g)}>
          {dict.gender[g]}
        </Chip>
      ))}
    </div>
  )
}
