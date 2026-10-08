import Link from 'next/link'
import {
  ChevronDown,
  Flame,
  MessageSquareText,
  ScanFace,
  ShieldAlert,
  Shuffle,
  Smartphone,
} from 'lucide-react'
import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { ctaClassName } from './landing-hero'

// Each section uses its own layout family (.claude/skills/design-taste-frontend):
// bento for the three modes, list beside a heading for safety, accordion for FAQ.

export function LandingFeatures({ t }: { t: LandingDictionary }) {
  const { swipe, feed, random } = t.features
  return (
    <section aria-labelledby="features-title" className="mx-auto w-full max-w-5xl px-5 py-16">
      <h2 id="features-title" className="mb-8 text-3xl font-bold tracking-tight md:text-4xl">
        {t.featuresTitle}
      </h2>
      {/* Exactly 3 cells: swipes lead (2x2), feed and random chat stack beside it. One column on phones. */}
      <ul className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
        <li className="border-accent/25 from-accent/20 via-accent/5 relative flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl border bg-gradient-to-br to-transparent p-6 md:col-span-2 md:row-span-2 md:min-h-96 md:p-8">
          <Flame
            className="text-accent/15 absolute -top-6 -right-6 size-56 md:size-72"
            strokeWidth={1.5}
            aria-hidden
          />
          <Flame className="text-accent relative mb-4 size-8" aria-hidden />
          <h3 className="relative mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {swipe.title}
          </h3>
          <p className="text-foreground/75 relative max-w-[40ch] md:text-lg">{swipe.text}</p>
        </li>
        <li className="card flex flex-col border p-6">
          <MessageSquareText className="text-accent mb-3 size-7" aria-hidden />
          <h3 className="mb-1 text-lg font-semibold">{feed.title}</h3>
          <p className="text-muted">{feed.text}</p>
        </li>
        <li className="border-border flex flex-col rounded-3xl border bg-[repeating-linear-gradient(135deg,var(--surface)_0_12px,var(--background)_12px_24px)] p-6">
          <Shuffle className="text-accent mb-3 size-7" aria-hidden />
          <h3 className="mb-1 text-lg font-semibold">{random.title}</h3>
          <p className="text-muted">{random.text}</p>
        </li>
      </ul>
    </section>
  )
}

export function LandingSafety({ t }: { t: LandingDictionary }) {
  const { selfie, phone, report } = t.safety
  const items = [
    { icon: ScanFace, ...selfie },
    { icon: Smartphone, ...phone },
    { icon: ShieldAlert, ...report },
  ]
  return (
    <section
      aria-labelledby="safety-title"
      className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-16 md:grid-cols-[2fr_3fr] md:gap-12"
    >
      <h2
        id="safety-title"
        className="text-3xl font-bold tracking-tight text-balance md:sticky md:top-8 md:self-start md:text-4xl"
      >
        {t.safetyTitle}
      </h2>
      <ul className="divide-border flex flex-col divide-y">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 py-6 first:pt-0 last:pb-0">
            <span className="bg-accent/10 text-accent flex size-11 shrink-0 items-center justify-center rounded-2xl">
              <Icon className="size-6" aria-hidden />
            </span>
            <div>
              <h3 className="mb-1 text-lg font-semibold">{title}</h3>
              <p className="text-muted leading-relaxed">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LandingFaq({ t }: { t: LandingDictionary }) {
  return (
    <section aria-labelledby="faq-title" className="mx-auto w-full max-w-3xl px-5 py-16">
      <h2 id="faq-title" className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">
        {t.faqTitle}
      </h2>
      <div className="flex flex-col gap-3">
        {t.faq.map(({ q, a }) => (
          <details key={q} className="group card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold select-none [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown
                className="text-muted size-5 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="text-muted px-5 pb-5 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

// Same label and target as the hero CTA: one label per intent.
export function LandingCta({ locale, t }: { locale: Locale; t: LandingDictionary }) {
  return (
    <section
      aria-labelledby="cta-title"
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-5 py-20 text-center"
    >
      <h2 id="cta-title" className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
        {t.ctaTitle}
      </h2>
      <Link href={localePath(locale, '/login')} className={`${ctaClassName} w-full sm:w-auto`}>
        {t.hero.cta}
      </Link>
      <p className="text-muted text-sm">{t.ctaNote}</p>
    </section>
  )
}
