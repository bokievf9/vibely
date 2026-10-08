'use client'

import { Fragment, type ComponentProps } from 'react'
import { Check } from 'lucide-react'
import { LocaleLink, useI18n } from '@/i18n/client'

type Props = ComponentProps<'input'> & { error?: string }

// "I am 18+ and agree to the Terms and Privacy Policy" with links (opened in a new tab so the
// half-filled onboarding form is not lost), plus the notice that content and calls are recorded
// and stored for safety for up to 90 days.
export function TermsConsent({ error, id = 'acceptTerms', ...input }: Props) {
  const { dict } = useI18n()
  const link = (href: string, label: string) => (
    <LocaleLink
      key={href}
      href={href}
      target="_blank"
      rel="noopener"
      // Inline padding grows the tap area without moving the text.
      className="text-accent py-1.5 font-medium underline underline-offset-2"
    >
      {label}
    </LocaleLink>
  )
  const parts = dict.legal.consent.split(/(\{terms\}|\{privacy\})/).map((part, i) => {
    if (part === '{terms}') return link('/terms', dict.legal.consentTerms)
    if (part === '{privacy}') return link('/privacy', dict.legal.consentPrivacy)
    return <Fragment key={i}>{part}</Fragment>
  })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        {/* 44px tap area around a 24px box, in the app's own radius instead of the native one. */}
        <label
          htmlFor={id}
          className="relative -m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center"
        >
          <input
            id={id}
            type="checkbox"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-msg` : undefined}
            className="peer border-border bg-surface checked:border-accent checked:bg-accent focus-visible:ring-accent focus-visible:ring-offset-background size-6 cursor-pointer appearance-none rounded-lg border-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none aria-invalid:border-red-500"
            {...input}
          />
          <Check
            className="pointer-events-none absolute size-4 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden
          />
        </label>
        <label htmlFor={id} className="pt-px text-sm leading-relaxed">
          {parts}
          {/* Safety recording notice (CLAUDE.md protocol): part of what the user agrees to. */}
          <span className="text-muted mt-1 block text-xs">{dict.legal.consentRecording}</span>
        </label>
      </div>
      {error && (
        <p id={`${id}-msg`} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
