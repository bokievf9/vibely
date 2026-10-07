import type { MetadataRoute } from 'next'
import { LOCALES } from '@/i18n/config'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibelydate.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: `${SITE}/${locale}/login`,
    changeFrequency: 'monthly',
    priority: locale === 'en' ? 1 : 0.8,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE}/${l}/login`])) },
  }))
}
