import type { MetadataRoute } from 'next'
import { LOCALES } from '@/i18n/config'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibelydate.com'

// Public pages only: everything else requires signing in.
const PAGES = [
  { path: '/login', priority: 1, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, priority, changeFrequency }) =>
    LOCALES.map((locale) => ({
      url: `${SITE}/${locale}${path}`,
      changeFrequency,
      priority: locale === 'en' ? priority : priority * 0.8,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE}/${l}${path}`])) },
    })),
  )
}
