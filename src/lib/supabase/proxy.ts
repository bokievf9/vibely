import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import { LOCALE_COOKIE, localePath } from '@/i18n/config'
import { preferredLocale, splitLocale } from '@/i18n/negotiate'
import type { Database } from '@/types/database.types'
import { authCookieOptions } from './config'
import {
  parseRefCode,
  REF_COOKIE,
  REF_COOKIE_MAX_AGE,
  REF_PARAM,
} from '@/features/referrals/constants'

const AUTH_ROUTES = ['/login', '/verify-otp']
// Open to everyone, signed in or not (the landing page "/" is handled separately). The service
// worker precaches /~offline whether or not anyone is signed in.
const PUBLIC_ROUTES = ['/privacy', '/terms', '/opengraph-image', '/twitter-image', '/~offline']

function matches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// Generated metadata images get a hash suffix: /en/opengraph-image-abc123.
function isPublic(pathname: string) {
  return (
    matches(pathname, PUBLIC_ROUTES) ||
    pathname.startsWith('/opengraph-image-') ||
    pathname.startsWith('/twitter-image-')
  )
}

// 1. Adds the locale prefix (/swipe → /en/swipe). The admin panel is unprefixed.
// 2. Refreshes the session cookie and does optimistic auth redirects.
// Real authorization happens in the Data Access Layer and in Postgres RLS.
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const { locale, rest } = splitLocale(pathname)

  if (!locale && !isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = localePath(preferredLocale(request), pathname)
    return NextResponse.redirect(url)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // Must run before anything else: it triggers the token refresh that writes cookies.
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = Boolean(data?.claims)
  const lang = locale ?? preferredLocale(request)

  const isLanding = rest === '/'

  // Invite link (/{lang}?ref=<code>): remembered until the visitor creates a profile.
  const ref = parseRefCode(request.nextUrl.searchParams.get(REF_PARAM))
  if (ref && !isSignedIn) {
    response.cookies.set(REF_COOKIE, ref, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      maxAge: REF_COOKIE_MAX_AGE,
    })
  }

  if (!isSignedIn && !isLanding && !isPublic(rest) && !matches(rest, AUTH_ROUTES)) {
    return redirectWithCookies(request, response, localePath(lang, '/login'))
  }
  // Signed-in users skip the landing page and the sign-in screens.
  if (isSignedIn && (isLanding || matches(rest, AUTH_ROUTES))) {
    return redirectWithCookies(request, response, localePath(lang, '/swipe'))
  }
  if (locale && request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return response
}

function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  redirect.headers.set('Cache-Control', 'private, no-store')
  return redirect
}
