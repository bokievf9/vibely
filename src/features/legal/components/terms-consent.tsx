'use client'

import { Fragment, type ComponentProps } from 'react'
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
      className="text-accent font-medium underline underline-offset-2"
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
        <input
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-msg` : undefined}
          className="accent-accent mt-0.5 size-5 shrink-0"
          {...input}
        />
        <label htmlFor={id} className="text-sm leading-relaxed">
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
