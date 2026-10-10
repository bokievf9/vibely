import type { MetadataRoute } from 'next'
import { LOCALES, localePath } from '@/i18n/config'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibelydate.com'

// Public pages only: landing, sign-in, privacy policy and terms, in every locale. The landing
// entries list the app screenshots it shows (image sitemap).
const PAGES: {
  path: string
  priority: number
  changeFrequency: 'weekly' | 'monthly' | 'yearly'
}[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/login', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
]

const LANDING_IMAGES = ['discover', 'blind-date', 'feed', 'duo', 'statuses', 'safety'].map(
  (s) => `${SITE}/landing/screens/${s}.webp`,
)

const url = (locale: (typeof LOCALES)[number], path: string) => `${SITE}${localePath(locale, path)}`

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, priority, changeFrequency }) =>
    LOCALES.map((locale) => ({
      url: url(locale, path),
      changeFrequency,
      priority: locale === 'en' ? priority : Math.round(priority * 8) / 10,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, url(l, path)])) },
      ...(path === '/' ? { images: LANDING_IMAGES } : {}),
    })),
  )
}
