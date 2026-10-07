import { notFound } from 'next/navigation'
import { lang } from 'next/root-params'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, hasLocale, type Locale } from './config'
import type { Dictionary } from './dictionaries/en'

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./dictionaries/en').then((m) => m.en),
  ms: () => import('./dictionaries/ms').then((m) => m.ms),
  ru: () => import('./dictionaries/ru').then((m) => m.ru),
}

// Server Components: the locale comes from the /[lang] root segment.
export async function getLocale(): Promise<Locale> {
  const value = await lang()
  if (!hasLocale(value)) notFound()
  return value
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  return dictionaries[locale ?? (await getLocale())]()
}

// Server Actions can't read root params; src/proxy.ts keeps this cookie in sync with the URL.
export async function getActionLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return hasLocale(value) ? value : DEFAULT_LOCALE
}
