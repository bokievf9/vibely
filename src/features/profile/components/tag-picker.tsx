'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { Tag } from '../queries'
import { MAX_TAGS } from '../schemas'
import { TAG_CATEGORIES, type TagCategory } from '../tag-categories'

type Props = { tags: Tag[]; value: number[]; onChange: (value: number[]) => void }

// Case- and accent-insensitive: "cafe" finds "Café".
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()

// How many chips the browse view shows before "Show all": enough to pick from, short enough that
// the rest of the form stays reachable without a scroller nested inside the page.
const PREVIEW_CHIPS = 24

// Interests grouped by category: search (current language), category filter, selected row on top.
export function TagPicker({ tags, value, onChange }: Props) {
  const { dict } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<TagCategory | null>(null)
  const [expanded, setExpanded] = useState(false)
  const search = normalize(useDeferredValue(query).trim())
  const label = (tag: Tag) => dict.tags[tag.slug] ?? tag.slug

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  const full = value.length >= MAX_TAGS

  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const selected = value.flatMap((id) => byId.get(id) ?? [])

  // Search looks across all categories; otherwise the chip filter narrows to one.
  const groups = useMemo(() => {
    const visible = tags.filter((t) =>
      search
        ? normalize(dict.tags[t.slug] ?? t.slug).includes(search)
        : !category || t.category === category,
    )
    return TAG_CATEGORIES.map((c) => ({
      category: c,
      tags: visible.filter((t) => t.category === c),
    })).filter((g) => g.tags.length > 0)
  }, [tags, search, category, dict.tags])

  // Search results and a single category are short: show them whole. "All" is clamped inline.
  const total = groups.reduce((n, g) => n + g.tags.length, 0)
  const clamped = !search && !category && !expanded && total > PREVIEW_CHIPS
  const shown = clamped
    ? groups.reduce<{ left: number; out: typeof groups }>(
        (acc, g) => {
          if (acc.left <= 0) return acc
          const part = g.tags.slice(0, acc.left)
          return { left: acc.left - part.length, out: [...acc.out, { ...g, tags: part }] }
        },
        { left: PREVIEW_CHIPS, out: [] },
      ).out
    : groups

  const renderChip = (tag: Tag) => {
    const on = value.includes(tag.id)
    return (
      <Chip key={tag.id} selected={on} disabled={!on && full} onClick={() => toggle(tag.id)}>
        {label(tag)}
      </Chip>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <span className={cn('text-sm font-medium', full ? 'text-accent' : 'text-muted')}>
          {fmt(dict.tagPicker.selected, { count: value.length, max: MAX_TAGS })}
        </span>
        {selected.map((tag) => (
          <Chip key={tag.id} selected onClick={() => toggle(tag.id)} className="gap-1 pr-3">
            {label(tag)} <X className="size-3.5" aria-hidden />
          </Chip>
        ))}
      </div>

      <div className="relative">
        <Search className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.tagPicker.search}
          aria-label={dict.tagPicker.search}
          enterKeyHint="search"
          className="bg-surface border-border placeholder:text-muted focus:border-accent h-11 w-full rounded-2xl border pr-10 pl-10 text-base outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={dict.tagPicker.clear}
            className="text-muted absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {!search && (
        <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1">
          <Chip selected={!category} onClick={() => setCategory(null)} className="shrink-0">
            {dict.tagPicker.all}
          </Chip>
          {TAG_CATEGORIES.map((c) => (
            <Chip
              key={c}
              selected={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className="shrink-0"
            >
              {dict.tagCategories[c]}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {groups.length === 0 && <p className="text-muted py-2 text-sm">{dict.tagPicker.empty}</p>}
        {shown.map((g) => (
          <section key={g.category} className="flex flex-col gap-2">
            <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
              {dict.tagCategories[g.category]}
            </h3>
            <div className="flex flex-wrap gap-2">{g.tags.map(renderChip)}</div>
          </section>
        ))}
        {!search && !category && total > PREVIEW_CHIPS && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-accent active:bg-accent/10 -mx-2 flex h-11 items-center gap-1 self-start rounded-full px-3 text-sm font-semibold transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.97]"
          >
            {expanded
              ? dict.discoverui.showFewerTags
              : fmt(dict.discoverui.showAllTags, { count: total })}
            <ChevronDown
              className={cn('size-4 transition-transform duration-200', expanded && 'rotate-180')}
              aria-hidden
            />
          </button>
        )}
      </div>
    </div>
  )
}
