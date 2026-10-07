import type { MetadataRoute } from 'next'
import { LOCALES } from '@/i18n/config'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibelydate.com'

// Only the sign-in pages are public; everything else needs a verified account.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: LOCALES.map((l) => `/${l}/login`),
      disallow: ['/admin', '/api'],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
