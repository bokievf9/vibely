import type { Locale } from '@/i18n/config'

// Landing media per UI language: app screenshots in public/landing/screens/<locale>/ (1170x2532,
// demo personas from a QA run, app UI and messages in that language) and the hero promo video.
// A locale without its own set falls back to English.
export type ScreenName =
  'discover' | 'match' | 'blind-date' | 'chat' | 'statuses' | 'duo' | 'feed' | 'safety'

const MEDIA_LOCALES: readonly Locale[] = ['en', 'ms', 'ru']

function mediaLocale(locale: Locale): Locale {
  return MEDIA_LOCALES.includes(locale) ? locale : 'en'
}

export function screenSrc(locale: Locale, name: ScreenName): string {
  return `/landing/screens/${mediaLocale(locale)}/${name}.webp`
}

export function heroMedia(locale: Locale) {
  const l = mediaLocale(locale)
  return {
    poster: `/landing/hero-poster-${l}.webp`,
    webm: `/landing/hero-${l}.webm`,
    mp4: `/landing/hero-${l}.mp4`,
  }
}

// PNG copy of the Discover screen for the share image (the OG renderer does not read WebP).
export function ogScreenPath(locale: Locale): string {
  return `public/landing/og-discover-${mediaLocale(locale)}.png`
}
