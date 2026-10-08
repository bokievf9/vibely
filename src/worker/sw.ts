/// <reference lib="webworker" />
// Built by `serwist build` (serwist.config.mjs) into public/sw.js after `next build`.
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist'
import { registerPushHandlers } from './push'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const LOCALES = ['en', 'ms', 'ru']
const offlineUrl = (locale: string) => `/${locale}/~offline`
const localeOf = (url: string) => {
  const first = new URL(url).pathname.split('/')[1] ?? ''
  return LOCALES.includes(first) ? first : 'en'
}

// Privacy: a dating app must not leave profiles, photos or chats in device caches. Only
// build-hashed static files and public icons are cached. Pages, RSC payloads, Server Actions,
// /_next/image (signed photo URLs) and every Supabase request always go to the network.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'next-static',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin &&
        (url.pathname.startsWith('/icons/') ||
          url.pathname === '/favicon.ico' ||
          url.pathname === '/apple-icon.png'),
      handler: new StaleWhileRevalidate({ cacheName: 'app-icons' }),
    },
    {
      // Never cached; matched only so the offline fallback below can kick in.
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: LOCALES.map((locale) => ({
      url: offlineUrl(locale),
      matcher: ({ request }: { request: Request }) =>
        request.destination === 'document' && localeOf(request.url) === locale,
    })),
  },
})

registerPushHandlers()
serwist.addEventListeners()
