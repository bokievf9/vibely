import type { Metadata } from 'next'
import { LOCALES, TIME_ZONE, fmt, localePath, type Locale } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'
import { LEGAL_UPDATED_AT, PRIVACY_EMAIL, getLegalContent } from '../content'
import type { LegalDocumentId } from '../content/types'

const PATHS: Record<LegalDocumentId, string> = { privacy: '/privacy', terms: '/terms' }

function formatUpdated(locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: TIME_ZONE }).format(
    new Date(`${LEGAL_UPDATED_AT}T12:00:00+08:00`),
  )
}

export async function legalMetadata(id: LegalDocumentId): Promise<Metadata> {
  const locale = await getLocale()
  const [dict, content] = await Promise.all([getDictionary(locale), getLegalContent(locale)])
  return {
    title: dict.legal[id],
    description: content[id].description,
    alternates: {
      canonical: localePath(locale, PATHS[id]),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, PATHS[id])])),
    },
  }
}

// Privacy Policy / Terms of Use. Public: reachable signed in and signed out.
export async function LegalPage({ id }: { id: LegalDocumentId }) {
  const locale = await getLocale()
  const [dict, content] = await Promise.all([getDictionary(locale), getLegalContent(locale)])
  const doc = content[id]

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{dict.legal[id]}</h1>
        <p className="text-muted text-sm">
          {fmt(dict.legal.lastUpdated, { date: formatUpdated(locale) })}
        </p>
      </header>
      <p className="leading-relaxed">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section
          key={section.heading}
          id={section.id}
          className="flex scroll-mt-20 flex-col gap-2"
        >
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-foreground/90 leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.list && (
            <ul className="text-foreground/90 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <footer className="card p-4 text-sm">
        {dict.legal.contact}{' '}
        <a href={`mailto:${PRIVACY_EMAIL}`} className="text-accent font-medium underline">
          {PRIVACY_EMAIL}
        </a>
      </footer>
    </article>
  )
}
