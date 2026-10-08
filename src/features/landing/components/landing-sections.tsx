import Link from 'next/link'
import {
  ChevronDown,
  Flame,
  MessageSquareText,
  ScanFace,
  ShieldAlert,
  Shuffle,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { ctaClassName } from './landing-hero'

type Card = { icon: LucideIcon; title: string; text: string }

function CardGrid({ id, title, cards }: { id: string; title: string; cards: Card[] }) {
  return (
    <section aria-labelledby={id} className="mx-auto w-full max-w-5xl px-5 py-12">
      <h2 id={id} className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, title: cardTitle, text }) => (
          <li key={cardTitle} className="border-border bg-surface rounded-3xl border p-5">
            <Icon className="text-accent mb-3 size-7" aria-hidden />
            <h3 className="mb-1 text-lg font-semibold">{cardTitle}</h3>
            <p className="text-muted">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LandingFeatures({ t }: { t: LandingDictionary }) {
  const { swipe, feed, random } = t.features
  return (
    <CardGrid
      id="features-title"
      title={t.featuresTitle}
      cards={[
        { icon: Flame, ...swipe },
        { icon: MessageSquareText, ...feed },
        { icon: Shuffle, ...random },
      ]}
    />
  )
}

export function LandingSafety({ t }: { t: LandingDictionary }) {
  const { selfie, phone, report } = t.safety
  return (
    <CardGrid
      id="safety-title"
      title={t.safetyTitle}
      cards={[
        { icon: ScanFace, ...selfie },
        { icon: Smartphone, ...phone },
        { icon: ShieldAlert, ...report },
      ]}
    />
  )
}

export function LandingFaq({ t }: { t: LandingDictionary }) {
  return (
    <section aria-labelledby="faq-title" className="mx-auto w-full max-w-3xl px-5 py-12">
      <h2 id="faq-title" className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
        {t.faqTitle}
      </h2>
      <div className="flex flex-col gap-3">
        {t.faq.map(({ q, a }) => (
          <details key={q} className="group border-border bg-surface rounded-2xl border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown
                className="text-muted size-5 shrink-0 transition group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="text-muted px-5 pb-5">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function LandingCta({ locale, t }: { locale: Locale; t: LandingDictionary }) {
  return (
    <section
      aria-labelledby="cta-title"
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-5 py-16 text-center"
    >
      <h2 id="cta-title" className="text-3xl font-bold tracking-tight text-balance">
        {t.ctaTitle}
      </h2>
      <Link href={localePath(locale, '/login')} className={`${ctaClassName} w-full sm:w-auto`}>
        {t.ctaButton}
      </Link>
    </section>
  )
}
