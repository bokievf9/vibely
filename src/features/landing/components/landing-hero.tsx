import Link from 'next/link'
import { ArrowRight, Heart } from 'lucide-react'
import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'

export const ctaClassName =
  'bg-accent text-accent-foreground focus-visible:ring-accent focus-visible:ring-offset-background inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 font-semibold whitespace-nowrap select-none transition-[transform,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] active:opacity-90'

type Props = { locale: Locale; t: LandingDictionary }

export function LandingHeader({ locale, t }: Props) {
  return (
    <header className="mx-auto box-content flex h-16 w-full max-w-5xl items-center justify-between px-5 pt-[env(safe-area-inset-top)]">
      <Link href={localePath(locale, '/')} className="flex items-center gap-2" aria-label="Vibely">
        <Heart className="fill-accent text-accent size-6" aria-hidden />
        <span className="text-xl font-bold tracking-tight">Vibely</span>
      </Link>
      <nav aria-label="Vibely">
        <Link
          href={localePath(locale, '/login')}
          className="border-border bg-surface active:bg-border inline-flex h-10 items-center rounded-2xl border px-4 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]"
        >
          {t.signIn}
        </Link>
      </nav>
    </header>
  )
}

// Left-aligned typographic hero (.claude/skills/design-taste-frontend). It has no image on purpose:
// there are no real product photos yet, and stock faces on a dating site would mislead.
// TODO: real app screenshot (phone frame, ~1170x2532 webp) to the right of the copy at md+.
export function LandingHero({ locale, t }: Props) {
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto w-full max-w-5xl px-5 pt-14 pb-16 md:pt-24 md:pb-24"
    >
      <div className="flex max-w-3xl flex-col items-start gap-6">
        <h1
          id="hero-title"
          className="motion-safe:animate-rise text-4xl leading-[1.05] font-bold tracking-tighter text-balance md:text-6xl"
        >
          {t.hero.title}
        </h1>
        <p className="text-muted motion-safe:animate-rise max-w-[42ch] text-lg leading-relaxed text-pretty [animation-delay:80ms]">
          {t.hero.subtitle}
        </p>
        <Link
          href={localePath(locale, '/login')}
          className={`${ctaClassName} motion-safe:animate-rise w-full [animation-delay:160ms] sm:w-auto`}
        >
          {t.hero.cta}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
