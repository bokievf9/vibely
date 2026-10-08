'use client'

import { useState, type ReactNode } from 'react'
import { EyeOff, Heart, MessageCircleHeart, Sparkles, UserRoundX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { RangeSlider } from '@/components/ui/range-slider'
import { fmt } from '@/i18n/config'
import { useI18n } from '@/i18n/client'
import { GenderPicker } from '@/features/profile/components/gender-picker'
import { TagPicker } from '@/features/profile/components/tag-picker'
import type { Tag } from '@/features/profile/queries'
import type { JoinFilters } from '../schemas'
import { AliasAvatar } from './alias-avatar'
import { SearchingNow } from './searching-now'

type Props = {
  tags: Tag[]
  initial: JoinFilters
  pending: boolean
  error?: string
  onStart: (f: JoinFilters) => void
}

// What a blind date is, then who to meet (gender, age, optional shared interests).
export function StartScreen({ tags, initial, pending, error, onStart }: Props) {
  const { dict } = useI18n()
  const t = dict.blindDate
  const [f, setF] = useState(initial)

  return (
    <div className="flex flex-col gap-6 pb-6">
      <section className="bg-surface border-border relative overflow-hidden rounded-3xl border p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-16 h-48 bg-[radial-gradient(55%_60%_at_50%_40%,rgb(255_77_125/0.22),transparent)]"
        />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-20 w-36 items-center justify-center" aria-hidden>
            <AliasAvatar alias={402} size={64} className="absolute left-2 -rotate-6" />
            <AliasAvatar alias={118} size={64} className="absolute right-2 rotate-6" />
            <span className="bg-accent text-accent-foreground ring-surface relative z-10 flex size-9 items-center justify-center rounded-full ring-4">
              <Heart className="size-4 fill-current" />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl leading-tight font-bold tracking-tight text-balance">
              {t.heroTitle}
            </h2>
            <p className="text-muted text-pretty">{t.heroText}</p>
          </div>
        </div>
        <ul className="relative mt-5 flex flex-col gap-3 text-sm">
          <Point icon={<Sparkles className="size-4" />}>{t.pointAnon}</Point>
          <Point icon={<EyeOff className="size-4" />}>{t.pointPhotos}</Point>
          <Point icon={<MessageCircleHeart className="size-4" />}>{t.pointConnect}</Point>
          <Point icon={<UserRoundX className="size-4" />}>{t.pointPass}</Point>
        </ul>
      </section>

      <SearchingNow />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-2 text-sm font-medium">{t.lookingFor}</legend>
        <GenderPicker multiple value={f.genders} onChange={(genders) => setF({ ...f, genders })} />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted mb-2 text-sm font-medium">
          {fmt(t.age, { min: f.minAge, max: f.maxAge })}
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
        <legend className="text-muted mb-2 text-sm font-medium">{t.tags}</legend>
        <TagPicker tags={tags} value={f.tagIds} onChange={(tagIds) => setF({ ...f, tagIds })} />
      </fieldset>
      <FormError message={error} />
      <div className="flex flex-col gap-3">
        <Button fullWidth loading={pending} disabled={!f.genders.length} onClick={() => onStart(f)}>
          <Heart className="size-5" /> {t.start}
        </Button>
        <p className="text-muted px-2 text-center text-xs text-pretty">{t.safetyNote}</p>
      </div>
    </div>
  )
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="bg-accent/12 text-accent flex size-7 shrink-0 items-center justify-center rounded-full"
      >
        {icon}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  )
}
