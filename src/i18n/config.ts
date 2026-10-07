export const LOCALES = ['en', 'ms', 'ru'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

// Remembers the last used language; also lets Server Actions (no root params) know the locale.
export const LOCALE_COOKIE = 'vibely_locale'

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ms: 'Bahasa Melayu',
  ru: 'Русский',
}

// Dates and times are shown in Malaysia time.
export const TIME_ZONE = 'Asia/Kuala_Lumpur'

export function hasLocale(value: string | undefined): value is Locale {
  return LOCALES.some((l) => l === value)
}

export function localePath(locale: Locale, path: string) {
  return `/${locale}${path === '/' ? '' : path}`
}

// "Hello, {name}" + { name: 'Ali' } → "Hello, Ali"
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}
