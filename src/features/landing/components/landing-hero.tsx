import Link from 'next/link'
import { ArrowRight, Heart } from 'lucide-react'
import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'

export const ctaClassName =
  'bg-accent text-accent-foreground focus-visible:ring-accent focus-visible:ring-offset-background inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 font-semibold transition select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:opacity-90'

type Props = { locale: Locale; t: LandingDictionary }

export function LandingHeader({ locale, t }: Props) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Link href={localePath(locale, '/')} className="flex items-center gap-2" aria-label="Vibely">
        <Heart className="fill-accent text-accent size-7" aria-hidden />
        <span className="text-2xl font-bold tracking-tight">Vibely</span>
      </Link>
      <nav aria-label="Vibely">
        <Link
          href={localePath(locale, '/login')}
          className="border-border bg-surface active:bg-border inline-flex h-10 items-center rounded-2xl border px-4 text-sm font-semibold"
        >
          {t.signIn}
        </Link>
      </nav>
    </header>
  )
}

export function LandingHero({ locale, t }: Props) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-3xl rounded-full bg-[#ff4d7d]/25 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center md:py-24">
        <h1 id="hero-title" className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
          {t.hero.title}
        </h1>
        <p className="text-muted max-w-xl text-lg text-pretty">{t.hero.subtitle}</p>
        <Link href={localePath(locale, '/login')} className={`${ctaClassName} w-full sm:w-auto`}>
          {t.hero.cta}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
        <p className="text-muted text-sm">{t.hero.note}</p>
      </div>
    </section>
  )
}
