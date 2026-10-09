'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chipClassName } from '@/components/ui/chip'
import { FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { fmt } from '@/i18n/config'
import { useErrorText, useI18n } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { cn } from '@/lib/utils'
import { clearPlan } from '@/features/plans/actions'
import { PLAN_ICONS, PLAN_TAGS, type OwnPlan, type PlanTag } from '@/features/plans/tags'
import { clearStatus, setStatus } from '../actions'
import { EMOJI_PICKS, PLAN_EMOJI, STATUS_MAX_LENGTH, codePoints } from '../schemas'
import type { OwnStatus } from '../types'

type Props = {
  open: boolean
  own: OwnStatus | null
  plan: OwnPlan | null
  onClose: () => void
  onStatus: (own: OwnStatus | null) => void
  onPlan: (plan: OwnPlan | null) => void
}

const DAY_MS = 24 * 60 * 60 * 1000

// "What's your vibe?": the one place to say what you're up to. A status is an emoji and up to 60
// characters for 3 hours (the carousel); a quick pick fills it from the 18 plan presets and also
// sets the 24-hour plan (the badge on the Discover card and its filter). Plans keep living on
// their own for 24 hours, so the sheet also shows the current plan and can clear it.
export function VibeSheet({ open, own, plan, onClose, onStatus, onPlan }: Props) {
  const { dict } = useI18n()
  const t = dict.statuses
  const errorText = useErrorText()
  const [emoji, setEmoji] = useState(own?.emoji ?? EMOJI_PICKS[0])
  const [text, setText] = useState(own?.text ?? '')
  const [planTag, setPlanTag] = useState<PlanTag | null>(null)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const length = codePoints(text.trim())
  const tooLong = length > STATUS_MAX_LENGTH
  const canPost = length > 0 && !tooLong && !pending

  const pick = (tag: PlanTag) => {
    setPlanTag(tag)
    setEmoji(PLAN_EMOJI[tag])
    setText(dict.plans.tags[tag])
    setError(undefined)
  }

  const post = () =>
    startTransition(async () => {
      const result = await setStatus({ emoji, text, planTag })
      if (!result.ok) return setError(result.error)
      setError(undefined)
      onStatus(result.data)
      if (planTag) onPlan({ tag: planTag, expiresAt: new Date(Date.now() + DAY_MS).toISOString() })
      setPlanTag(null)
      onClose()
    })

  const clear = () =>
    startTransition(async () => {
      const result = await clearStatus()
      if (!result.ok) return setError(result.error)
      onStatus(null)
      setText('')
      onClose()
    })

  const removePlan = () =>
    startTransition(async () => {
      const result = await clearPlan()
      if (!result.ok) return setError(result.error)
      onPlan(null)
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.vibe}
      footer={
        <div className="flex flex-col gap-2">
          <Button fullWidth loading={pending} disabled={!canPost} onClick={post}>
            {own ? t.update : t.post}
          </Button>
          {own && (
            <Button variant="ghost" fullWidth disabled={pending} onClick={clear}>
              {t.clear}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted text-sm text-pretty">{t.hint}</p>

        <div role="group" aria-label={t.emojiLabel} className="-mx-1 flex flex-wrap gap-1.5">
          {[...new Set([emoji, ...EMOJI_PICKS])].map((e) => (
            <button
              key={e}
              type="button"
              aria-label={e}
              aria-pressed={emoji === e}
              onClick={() => setEmoji(e)}
              className={cn(
                'flex size-11 items-center justify-center rounded-full text-2xl transition-[transform,scale,background-color] duration-150 ease-out active:scale-[0.92]',
                emoji === e ? 'bg-accent/20 ring-accent/60 ring-2' : 'active:bg-fill',
              )}
            >
              {e}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="sr-only">{t.textLabel}</span>
          <span className="relative flex items-center">
            <span aria-hidden className="pointer-events-none absolute left-4 text-xl">
              {emoji}
            </span>
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(undefined)
              }}
              placeholder={t.textPlaceholder}
              enterKeyHint="send"
              aria-invalid={tooLong || undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canPost) post()
              }}
              className="pr-16 pl-12"
            />
            <span
              className={cn(
                'text-caption pointer-events-none absolute right-4 tabular-nums',
                tooLong ? 'text-danger' : 'text-muted',
              )}
            >
              {length}/{STATUS_MAX_LENGTH}
            </span>
          </span>
        </label>

        {planTag && (
          <p className="bg-accent/10 text-accent flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-3 text-sm">
            <span className="min-w-0 flex-1">
              {fmt(t.planLinked, { plan: dict.plans.tags[planTag] })}
            </span>
            <button
              type="button"
              onClick={() => setPlanTag(null)}
              className="active:bg-accent/15 flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 font-medium"
            >
              <X className="size-3.5" aria-hidden />
              {t.planUnlink}
            </button>
          </p>
        )}

        <section className="flex flex-col gap-2" aria-labelledby="vibe-quick-picks">
          <h3 id="vibe-quick-picks" className="text-headline">
            {t.quickPicks}
          </h3>
          <p className="text-muted text-footnote text-pretty">{t.quickPicksHint}</p>
          <ul className="flex flex-wrap gap-2">
            {PLAN_TAGS.map((tag) => {
              const Icon = PLAN_ICONS[tag]
              return (
                <li key={tag}>
                  <button
                    type="button"
                    aria-pressed={planTag === tag}
                    onClick={() => pick(tag)}
                    className={chipClassName(planTag === tag, 'gap-1.5 px-3.5')}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {dict.plans.tags[tag]}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {plan && !planTag && (
          <div className="border-border flex items-center gap-2 border-t pt-3 text-sm">
            <span className="text-muted min-w-0 flex-1">
              {fmt(t.currentPlan, { plan: dict.plans.tags[plan.tag] })}
            </span>
            <Button size="sm" variant="secondary" disabled={pending} onClick={removePlan}>
              {t.clearPlan}
            </Button>
          </div>
        )}

        <FormError message={tooLong ? errorText('statusTooLong') : errorText(error)} />
      </div>
    </Modal>
  )
}
