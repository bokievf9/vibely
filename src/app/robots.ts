import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibelydate.com'

// Public: landing, sign-in, privacy and terms (see sitemap.ts). Everything else needs a verified
// account and redirects to sign-in, so crawlers only waste time there.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
