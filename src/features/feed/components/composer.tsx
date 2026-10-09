'use client'

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { PenLine, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useErrorText } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { UserResult } from '@/i18n/errors'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { IdentityToggle } from './identity-toggle'
import { useAutoGrow } from './use-auto-grow'
import { useUpgradeHandler } from '@/features/plans/components/access-provider'

type Props = {
  // card: the new-post box at the top of the feed, one line until focused.
  // bar: the comment bar pinned to the bottom of a thread, keyboard stays open on send.
  variant?: 'card' | 'bar'
  id?: string
  placeholder: string
  submitLabel: string
  maxLength: number
  hint?: string
  className?: string
  onSubmit: (body: string, asMe: boolean) => Promise<UserResult<string>>
  onDone: () => void
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// Text box shared by new posts and comments, with the "Anonymous / As me" choice.
// The choice and the actions only appear once the box is focused or has text.
export function Composer({
  variant = 'card',
  id,
  placeholder,
  submitLabel,
  maxLength,
  hint,
  className,
  onSubmit,
  onDone,
}: Props) {
  const errorText = useErrorText()
  const upgradeOr = useUpgradeHandler()
  const [body, setBody] = useState('')
  const [asMe, setAsMe] = useState(false)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const open = focused || body.length > 0
  useAutoGrow(inputRef, body)

  // Leaving an empty composer folds it back. Deferred so the tap that caused the blur lands on its
  // target before the layout below moves up. Buttons inside the form never take focus (see
  // keepFocus), so choosing "As me" or pressing Post does not count as leaving.
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(blurTimer.current), [])
  const onBlur = () => {
    clearTimeout(blurTimer.current)
    blurTimer.current = setTimeout(() => {
      const input = inputRef.current
      if (input && !input.value && document.activeElement !== input) setFocused(false)
    }, 150)
  }
  const keepFocus = (e: PointerEvent<HTMLFormElement> | MouseEvent<HTMLFormElement>) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault()
  }

  const submit = () => {
    if (!body.trim() || pending) return
    startTransition(async () => {
      const result = await onSubmit(body, asMe)
      if (!result.ok) return upgradeOr(result) ? setError(undefined) : setError(result.error)
      haptic('success')
      setError(undefined)
      setBody('')
      if (variant === 'card') {
        setFocused(false)
        inputRef.current?.blur()
      }
      onDone()
    })
  }

  const counter = (
    <span
      className={cn(
        'text-xs tabular-nums',
        body.length > maxLength * 0.9 ? 'text-amber-400' : 'text-muted',
      )}
    >
      {body.length}/{maxLength}
    </span>
  )

  const errorLine = error && (
    <p role="alert" className="text-danger px-1 text-sm">
      {errorText(error)}
    </p>
  )

  const textarea = (
    <textarea
      ref={inputRef}
      id={id}
      value={body}
      rows={1}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={placeholder}
      enterKeyHint={variant === 'bar' ? 'send' : undefined}
      onFocus={() => {
        clearTimeout(blurTimer.current)
        setFocused(true)
      }}
      onBlur={onBlur}
      onChange={(e) => setBody(e.target.value)}
      onKeyDown={(e) => {
        if (variant === 'bar' && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape' && !body) {
          setFocused(false)
          e.currentTarget.blur()
        }
      }}
      className={cn(
        'placeholder:text-muted w-full resize-none text-base outline-none',
        variant === 'card'
          ? 'max-h-60 min-w-0 flex-1 bg-transparent py-3 text-[17px] tracking-[-0.012em]'
          : 'bg-surface-raised border-border focus:border-accent/60 max-h-32 min-h-11 flex-1 rounded-[1.375rem] border px-4 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-colors',
      )}
    />
  )

  if (variant === 'bar') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        // Keep the keyboard up: the textarea must not lose focus to a button in the bar.
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        className={cn('flex flex-col gap-2', className)}
      >
        <Reveal show={open}>
          <div className="flex flex-col gap-1.5 pb-1">
            <IdentityToggle asMe={asMe} onChange={setAsMe} />
            {hint && <p className="text-muted text-xs">{hint}</p>}
          </div>
        </Reveal>
        {errorLine}
        <div className="flex items-end gap-2">
          {textarea}
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            loading={pending}
            disabled={!body.trim()}
            aria-label={submitLabel}
            onClick={() => inputRef.current?.focus()}
          >
            <SendHorizontal className="size-5" />
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onClick={() => !open && inputRef.current?.focus()}
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
      className={cn(
        'card flex flex-col px-3.5 py-1.5 transition-[border-color] duration-200',
        open && 'border-accent/35',
        className,
      )}
    >
      <Reveal show={open}>
        <div className="pt-2 pb-1">
          <IdentityToggle asMe={asMe} onChange={setAsMe} />
        </div>
      </Reveal>
      {/* Prompt row: an accent pen in a soft tile, then the field. */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-accent/[0.12] text-accent mt-[0.4375rem] flex size-9 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
        >
          <PenLine className="size-[1.125rem]" />
        </span>
        {textarea}
      </div>
      <Reveal show={open}>
        <div className="flex items-center justify-between gap-3 pt-1 pb-1.5">
          {counter}
          <Button
            type="submit"
            size="sm"
            className="h-11 px-5"
            loading={pending}
            disabled={!body.trim()}
          >
            {submitLabel}
          </Button>
        </div>
      </Reveal>
      {errorLine}
    </form>
  )
}

// Height + opacity reveal (the accordion case: no transform does this).
function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
