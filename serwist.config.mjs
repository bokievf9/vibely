// @ts-check
// Builds the service worker after `next build` (Turbopack has no webpack plugin): `serwist build`.
import { readFileSync } from 'node:fs'
import { serwist } from '@serwist/next/config'

// Changes on every build, so the precached offline pages are refreshed with each deploy.
const revision = readFileSync('.next/BUILD_ID', 'utf8').trim()

export default serwist({
  swSrc: 'src/worker/sw.ts',
  swDest: 'public/sw.js',
  // Prerendered HTML is not precached: only the offline page is (privacy: no app pages offline).
  precachePrerendered: false,
  additionalPrecacheEntries: ['en', 'ms', 'ru'].map((lang) => ({
    url: `/${lang}/~offline`,
    revision,
  })),
  globIgnores: ['public/sw.js.map'],
})
