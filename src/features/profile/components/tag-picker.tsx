'use client'

import { Chip } from '@/components/ui/chip'
import { useI18n } from '@/i18n/client'
import type { Tag } from '../queries'
import { MAX_TAGS } from '../schemas'

type Props = { tags: Tag[]; value: number[]; onChange: (value: number[]) => void }

export function TagPicker({ tags, value, onChange }: Props) {
  const { dict } = useI18n()
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const selected = value.includes(tag.id)
        return (
          <Chip
            key={tag.id}
            selected={selected}
            disabled={!selected && value.length >= MAX_TAGS}
            onClick={() => toggle(tag.id)}
          >
            {dict.tags[tag.slug] ?? tag.slug}
          </Chip>
        )
      })}
    </div>
  )
}
