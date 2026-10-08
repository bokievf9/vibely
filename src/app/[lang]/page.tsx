import type { Metadata } from 'next'
import { LandingFooter } from '@/features/landing/components/landing-footer'
import { LandingHeader, LandingHero } from '@/features/landing/components/landing-hero'
import { LandingJsonLd } from '@/features/landing/components/landing-json-ld'
import {
  LandingCta,
  LandingFaq,
  LandingFeatures,
  LandingSafety,
} from '@/features/landing/components/landing-sections'
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
    twitter: { card: 'summary_large_image', title: t.metaTitle, description: t.metaDescription },
  }
}

export default async function LandingPage() {
  const locale = await getLocale()
  const { landing: t } = await getDictionary(locale)
  return (
    <>
      <LandingJsonLd locale={locale} t={t} site={publicEnv.NEXT_PUBLIC_SITE_URL} />
      <LandingHeader locale={locale} t={t} />
      <main className="flex flex-1 flex-col">
        <LandingHero locale={locale} t={t} />
        <LandingFeatures t={t} />
        <LandingSafety t={t} />
        <LandingFaq t={t} />
        <LandingCta locale={locale} t={t} />
      </main>
      <LandingFooter locale={locale} t={t} />
    </>
  )
}
