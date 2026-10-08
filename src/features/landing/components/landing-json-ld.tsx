import { localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'

type Props = { locale: Locale; t: LandingDictionary; site: string }

// Structured data for search engines: Organization + WebSite + FAQPage.
// A data block (type="application/ld+json") is never executed, so the CSP does not apply to it.
// "<" is escaped so no string can close the <script> tag.
export function LandingJsonLd({ locale, t, site: siteUrl }: Props) {
  const site = new URL(siteUrl).origin
  const url = new URL(localePath(locale, '/'), site).href
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'Vibely',
        url: site,
        logo: `${site}/icons/icon-512.png`,
        areaServed: { '@type': 'Country', name: 'Malaysia' },
      },
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        name: 'Vibely',
        url,
        inLanguage: locale,
        description: t.metaDescription,
        publisher: { '@id': `${site}/#organization` },
      },
      {
        '@type': 'FAQPage',
        url,
        inLanguage: locale,
        mainEntity: t.faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
