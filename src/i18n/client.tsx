'use client'

import { createContext, use, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { localePath, type Locale } from './config'
import type { Dictionary, ErrorKey } from './dictionaries/en'

type I18n = { locale: Locale; dict: Dictionary }
const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ locale, dict, children }: I18n & { children: ReactNode }) {
  return <I18nContext value={{ locale, dict }}>{children}</I18nContext>
}

export function useI18n(): I18n {
  const value = use(I18nContext)
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>')
  return value
}

// For shared UI that also renders in the admin panel, which has no provider.
export function useOptionalI18n(): I18n | null {
  return use(I18nContext)
}

// Server Actions return error keys; this turns one into text.
export function useErrorText() {
  const { dict } = useI18n()
  return (key: string | undefined) =>
    key === undefined ? undefined : (dict.errors[key as ErrorKey] ?? dict.errors.generic)
}

// <Link> that prefixes the current locale: <LocaleLink href="/chats" />
export function LocaleLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const { locale } = useI18n()
  return <Link href={localePath(locale, href)} {...props} />
}

export function useLocaleRouter() {
  const router = useRouter()
  const { locale } = useI18n()
  return {
    push: (path: string) => router.push(localePath(locale, path)),
    replace: (path: string) => router.replace(localePath(locale, path)),
    refresh: () => router.refresh(),
  }
}
