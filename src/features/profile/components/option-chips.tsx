'use client'

import { Chip } from '@/components/ui/chip'

type SingleProps = {
  options: readonly string[]
  labels: Record<string, string>
  value: string | null | undefined
  onChange: (value: string | null) => void
}

// Single choice; tapping the selected chip clears it (every "about" field is optional).
export function OptionChips({ options, labels, value, onChange }: SingleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} selected={value === o} onClick={() => onChange(value === o ? null : o)}>
          {labels[o] ?? o}
        </Chip>
      ))}
    </div>
  )
}

type MultiProps = {
  options: readonly string[]
  labels: Record<string, string>
  value: string[] | undefined
  max: number
  onChange: (value: string[]) => void
}

export function MultiOptionChips({ options, labels, value = [], max, onChange }: MultiProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value.includes(o)
        return (
          <Chip
            key={o}
            selected={selected}
            disabled={!selected && value.length >= max}
            onClick={() => onChange(selected ? value.filter((v) => v !== o) : [...value, o])}
          >
            {labels[o] ?? o}
          </Chip>
        )
      })}
    </div>
  )
}
