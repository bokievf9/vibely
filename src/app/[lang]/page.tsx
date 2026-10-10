import type { Metadata } from 'next'
import { BlindStory } from '@/features/landing/components/blind-story'
import { CtaProvider } from '@/features/landing/components/cta'
import { LandingFooter } from '@/features/landing/components/landing-footer'
import { LandingHeader, LandingHero, TrustStrip } from '@/features/landing/components/landing-hero'
import { LandingJsonLd } from '@/features/landing/components/landing-json-ld'
import {
  EventBlock,
  FaqSection,
  FinalCta,
  PlansSection,
  SafetySection,
} from '@/features/landing/components/landing-sections'
import { ScrollDepth } from '@/features/landing/components/scroll-depth'
import { WaysBento } from '@/features/landing/components/ways-bento'
import { DEFAULT_LOCALE, LOCALES, localePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'
import { publicEnv } from '@/lib/env'

const OG_LOCALE = { en: 'en_MY', ms: 'ms_MY', ru: 'ru_RU' } as const

// Public landing page, fully static (prerendered per locale).
// Signed-in visitors never see it: src/lib/supabase/proxy.ts redirects them to /swipe.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { landing: t } = await getDictionary(locale)
  const url = localePath(locale, '/')
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, '/')])),
        'x-default': localePath(DEFAULT_LOCALE, '/'),
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Vibely',
      title: t.metaTitle,
      description: t.metaDescription,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
    keywords: [
      'dating app Malaysia',
      'aplikasi temu janji',
      'blind date',
      'verified dating',
      'Vibely',
    ],
    twitter: { card: 'summary_large_image', title: t.metaTitle, description: t.metaDescription },
  }
}

const STORY_SCREENS = [
  '/landing/screens/blind-date.webp',
  '/landing/screens/match.webp',
  '/landing/screens/chat.webp',
]

// Sections in order: hero, trust strip, five ways (bento), Blind Dating story, safety, next
// Blind Dating Night (only when scheduled), plans, FAQ, final CTA. Each uses its own layout
// family (.claude/skills/design-taste-frontend). Client islands: the CTA sheet, the hero video,
// the story's active step, FAQ and scroll-depth analytics.
export default async function LandingPage() {
  const locale = await getLocale()
  const { landing: t } = await getDictionary(locale)
  return (
    <CtaProvider locale={locale} t={{ cta: t.cta, waitlist: t.waitlist }}>
      <LandingJsonLd locale={locale} t={t} site={publicEnv.NEXT_PUBLIC_SITE_URL} />
      <LandingHeader locale={locale} t={t} />
      <main className="relative flex flex-1 flex-col">
        <ScrollDepth />
        <LandingHero t={t} />
        <TrustStrip t={t} />
        <WaysBento t={t} />
        <BlindStory
          title={t.story.title}
          steps={t.story.steps.map((step, i) => ({ ...step, src: STORY_SCREENS[i] ?? '' }))}
        />
        <SafetySection locale={locale} t={t} />
        <EventBlock locale={locale} t={t} />
        <PlansSection t={t} />
        <FaqSection t={t} />
        <FinalCta t={t} />
      </main>
      <LandingFooter locale={locale} t={t} />
    </CtaProvider>
  )
}
