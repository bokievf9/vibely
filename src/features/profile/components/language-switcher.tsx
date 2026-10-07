'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { chipClassName } from '@/components/ui/chip'
import { LOCALES, LOCALE_NAMES } from '@/i18n/config'
import { useI18n } from '@/i18n/client'

// Same page, other language. The proxy remembers the choice in a cookie.
export function LanguageSwitcher() {
  const { locale, dict } = useI18n()
  const pathname = usePathname()
  const rest = pathname.replace(/^\/[^/]+/, '')

  return (
    <nav aria-label={dict.profile.language} className="flex flex-wrap gap-2">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}`}
          hrefLang={l}
          aria-current={l === locale ? 'true' : undefined}
          className={chipClassName(l === locale)}
        >
          {LOCALE_NAMES[l]}
        </Link>
      ))}
    </nav>
  )
}
