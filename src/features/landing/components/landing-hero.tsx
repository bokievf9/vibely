import Link from 'next/link'
import { Heart, ScanFace, ShieldCheck, Smartphone } from 'lucide-react'
import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { heroMedia } from '../media'
import { CtaButton } from './cta'
import { HeroVideo } from './hero-video'

type Props = { locale: Locale; t: LandingDictionary }

export const container = 'mx-auto w-full max-w-6xl px-5 md:px-8'

// "Already have an account? Sign in" stays in the header whatever the CTA does (owner decision).
export function LandingHeader({ locale, t }: Props) {
  return (
    <header
      className={`${container} flex min-h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between gap-3 pt-[env(safe-area-inset-top)]`}
    >
      <Link
        href={localePath(locale, '/')}
        className="flex min-h-11 shrink-0 items-center gap-2"
        aria-label="Vibely"
      >
        <span
          aria-hidden
          className="btn-accent flex size-9 items-center justify-center rounded-[0.7rem]"
        >
          <Heart className="size-[1.125rem] fill-current" />
        </span>
        <span className="text-xl font-bold tracking-[-0.03em]">Vibely</span>
      </Link>
      <p className="text-muted text-footnote sm:text-callout text-right">
        <span className="max-[359px]:sr-only">{t.header.haveAccount} </span>
        <Link
          href={localePath(locale, '/login')}
          className="text-foreground decoration-accent inline-flex min-h-11 items-center px-1 font-semibold underline-offset-4 hover:underline"
        >
          {t.header.signIn}
        </Link>
      </p>
    </header>
  )
}

// Asymmetric split: copy left, the app in a phone on the right (below the copy on phones).
// Hero stack: headline, subtitle, one CTA. Nothing else.
export function LandingHero({ locale, t }: Props) {
  return (
    <section
      aria-labelledby="hero-title"
      className={`${container} grid items-center gap-12 pt-6 pb-16 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:pt-10 md:pb-20 lg:pt-14 lg:pb-24`}
    >
      <div className="flex flex-col items-start gap-5 md:gap-6">
        <h1
          id="hero-title"
          className="text-[clamp(2.125rem,9.4vw,2.5rem)] leading-[1.06] font-bold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[4rem]"
        >
          {t.hero.title}
        </h1>
        <p className="text-muted motion-safe:animate-rise max-w-[36ch] text-lg leading-relaxed text-pretty [animation-delay:60ms] md:text-xl">
          {t.hero.subtitle}
        </p>
        <CtaButton
          location="hero"
          className="motion-safe:animate-rise mt-1 w-full [animation-delay:120ms] sm:w-auto"
        />
      </div>
      <div className="relative isolate mx-auto w-[min(72vw,280px)] md:w-[300px] lg:w-[330px]">
        {/* Soft rose light behind the phone, tinted like the page bloom (no neon glow). */}
        <div
          aria-hidden
          className="absolute -inset-x-16 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,rgb(255_77_125/0.22),transparent)]"
        />
        <div className="motion-safe:animate-rise [animation-delay:180ms]">
          <HeroVideo label={t.hero.videoLabel} media={heroMedia(locale)} />
        </div>
      </div>
    </section>
  )
}

// Facts only, directly under the hero.
export function TrustStrip({ t }: { t: LandingDictionary }) {
  const items = [
    { icon: ScanFace, text: t.trust.selfie },
    { icon: Smartphone, text: t.trust.phone },
    { icon: ShieldCheck, text: t.trust.adults },
  ]
  return (
    <section aria-label={t.trust.label} className="border-border bg-surface/40 border-y">
      <ul className={`${container} grid gap-x-8 gap-y-3 py-5 sm:grid-cols-3 sm:py-6`}>
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="text-callout flex items-center gap-3 font-medium">
            <span className="bg-accent/12 text-accent flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Icon className="size-5" aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}
