'use client'

import Link from 'next/link'
import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { track } from '@/lib/analytics'
import { signupOpen } from '@/lib/env.optional'
import { cn } from '@/lib/utils'
import { WaitlistSheet } from '@/features/waitlist/components/waitlist-sheet'

// Primary CTA: same rose fill, height and press feedback everywhere on the page.
export const ctaClassName =
  'btn-accent focus-visible:ring-accent focus-visible:ring-offset-background inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl px-6 text-[17px] font-semibold whitespace-nowrap select-none transition-[transform,scale,filter] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] active:brightness-95'

type Ctx = { locale: Locale; label: string; openWaitlist: (location: string) => void }
const CtaContext = createContext<Ctx | null>(null)

// Owns the early access sheet. Until NEXT_PUBLIC_SIGNUP_OPEN=true every CTA opens it; afterwards
// the same CTAs link to /login and the sheet is never mounted.
export function CtaProvider({
  locale,
  t,
  children,
}: {
  locale: Locale
  t: Pick<LandingDictionary, 'cta' | 'waitlist'>
  children: ReactNode
}) {
  const [source, setSource] = useState<string | null>(null)
  const openWaitlist = useCallback((location: string) => {
    track('waitlist_open', { location })
    setSource(location)
  }, [])
  const label = signupOpen ? t.cta.open : t.cta.waitlist
  return (
    <CtaContext value={{ locale, label, openWaitlist }}>
      {children}
      {!signupOpen && (
        <WaitlistSheet
          open={source !== null}
          onClose={() => setSource(null)}
          locale={locale}
          source={source ?? 'landing'}
          submitLabel={t.cta.waitlist}
          t={t.waitlist}
        />
      )}
    </CtaContext>
  )
}

// `location` names the place on the page for analytics (cta_click, waitlist_open).
export function CtaButton({ location, className }: { location: string; className?: string }) {
  const ctx = use(CtaContext)
  if (!ctx) throw new Error('CtaButton needs a CtaProvider')
  const classes = cn(ctaClassName, className)
  const content = (
    <>
      {ctx.label}
      <ArrowRight className="size-5" aria-hidden />
    </>
  )
  if (signupOpen) {
    return (
      <Link
        href={localePath(ctx.locale, '/login')}
        className={classes}
        onClick={() => track('cta_click', { location })}
      >
        {content}
      </Link>
    )
  }
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={classes}
      onClick={() => {
        track('cta_click', { location })
        ctx.openWaitlist(location)
      }}
    >
      {content}
    </button>
  )
}
