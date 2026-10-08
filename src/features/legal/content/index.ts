import 'server-only'
import type { Locale } from '@/i18n/config'
import type { LegalContent } from './types'

// NOTE: These texts are a plain-language draft that reflects how the app actually works.
// They MUST be reviewed by a Malaysian lawyer (PDPA 2010) before launch. When the wording
// changes, update LEGAL_UPDATED_AT and all three locales together.
export const LEGAL_UPDATED_AT = '2026-10-09'
export const PRIVACY_EMAIL = 'privacy@vibelydate.com'

const contents: Record<Locale, () => Promise<LegalContent>> = {
  en: () => import('./en').then((m) => m.en),
  ms: () => import('./ms').then((m) => m.ms),
  ru: () => import('./ru').then((m) => m.ru),
}

export function getLegalContent(locale: Locale): Promise<LegalContent> {
  return contents[locale]()
}
