import Link from 'next/link'
import { LOCALES, LOCALE_NAMES, localePath, type Locale } from '@/i18n/config'
import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { chipClassName } from '@/components/ui/chip'

export function LandingFooter({ locale, t }: { locale: Locale; t: LandingDictionary }) {
  return (
    <footer className="border-border mt-auto border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 md:px-8 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <nav aria-label={t.footer.language} className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={localePath(l, '/')}
              hrefLang={l}
              lang={l}
              aria-current={l === locale ? 'page' : undefined}
              className={chipClassName(l === locale)}
            >
              {LOCALE_NAMES[l]}
            </Link>
          ))}
        </nav>
        <div className="text-muted flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex gap-5">
            <li>
              <Link href={localePath(locale, '/privacy')} className="hover:text-foreground">
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href={localePath(locale, '/terms')} className="hover:text-foreground">
                {t.footer.terms}
              </Link>
            </li>
          </ul>
          <p>{t.footer.tagline}</p>
        </div>
      </div>
    </footer>
  )
}
