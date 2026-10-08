'use client'

import { useState, useTransition } from 'react'
import { CalendarHeart, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chipClassName } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { fmt, TIME_ZONE } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { clearPlan, setPlan } from '../actions'
import { PLAN_ICONS, PLAN_TAGS, type OwnPlan, type PlanTag } from '../tags'

type SheetProps = {
  open: boolean
  plan: OwnPlan | null
  onClose: () => void
  onChange: (plan: OwnPlan | null) => void
}

// Quick picker: one tap sets the plan (24 hours) and closes the sheet.
export function PlanPickerSheet({ open, plan, onClose, onChange }: SheetProps) {
  const { dict, locale } = useI18n()
  const t = dict.plans
  const errorText = useErrorText()
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const [picked, setPicked] = useState<PlanTag | null>(null)

  const choose = (tag: PlanTag) =>
    startTransition(async () => {
      setPicked(tag)
      const result = await setPlan(tag)
      setPicked(null)
      if (!result.ok) return setError(result.error)
      setError(undefined)
      onChange(result.data)
      onClose()
    })

  const clear = () =>
    startTransition(async () => {
      const result = await clearPlan()
      if (!result.ok) return setError(result.error)
      setError(undefined)
      onChange(null)
      onClose()
    })

  return (
    <Modal open={open} onClose={onClose} title={t.pick}>
      <div className="flex flex-col gap-4">
        <p className="text-muted text-sm">
          {plan
            ? fmt(t.until, {
                time: new Intl.DateTimeFormat(locale, {
                  timeZone: TIME_ZONE,
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(plan.expiresAt)),
              })
            : t.hint}
        </p>
        <ul className="flex flex-wrap gap-2">
          {PLAN_TAGS.map((tag) => {
            const Icon = PLAN_ICONS[tag]
            const selected = plan?.tag === tag
            return (
              <li key={tag}>
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => choose(tag)}
                  className={cn(
                    chipClassName(selected, 'gap-1.5 px-3.5'),
                    picked === tag && 'opacity-60',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t.tags[tag]}
                </button>
              </li>
            )
          })}
        </ul>
        <FormError message={errorText(error)} />
        {plan && (
          <Button variant="secondary" fullWidth disabled={pending} onClick={clear}>
            {t.clear}
          </Button>
        )}
      </div>
    </Modal>
  )
}

type ButtonProps = { initial: OwnPlan | null; variant: 'icon' | 'row' }

// Discover header (icon) and own profile (full-width row) entry points to the picker.
export function PlanButton({ initial, variant }: ButtonProps) {
  const { dict } = useI18n()
  const t = dict.plans
  const [plan, setPlanState] = useState(initial)
  const [open, setOpen] = useState(false)
  const Icon = plan ? PLAN_ICONS[plan.tag] : CalendarHeart
  const label = plan ? fmt(t.active, { plan: t.tags[plan.tag] }) : t.set

  return (
    <>
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => setOpen(true)}
          className="relative"
        >
          <Icon className={cn('size-6', plan && 'text-accent')} />
          {plan && (
            <span
              aria-hidden
              className="bg-accent ring-background absolute top-2.5 right-2.5 size-2 rounded-full ring-2"
            />
          )}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-surface border-border active:bg-border flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[transform,scale,background-color] duration-150 ease-out select-none active:scale-[0.98]"
        >
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              plan ? 'bg-accent/15 text-accent' : 'bg-border/60 text-muted',
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-muted text-xs font-medium">{t.title}</span>
            <span className="truncate font-semibold">{plan ? t.tags[plan.tag] : t.set}</span>
          </span>
          <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
        </button>
      )}
      <PlanPickerSheet
        open={open}
        plan={plan}
        onClose={() => setOpen(false)}
        onChange={setPlanState}
      />
    </>
  )
}
