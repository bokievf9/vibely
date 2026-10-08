import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip static assets, images, PWA files, metadata routes, the uptime health check and the
    // scheduled jobs (/api/cron/*, authorized by their own secret).
    '/((?!api/health$|api/cron/|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|apple-icon.png|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
