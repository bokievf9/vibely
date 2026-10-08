import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip static assets, images, PWA files, metadata routes, the uptime health check and the
    // server-to-server call routes (LiveKit webhook, recordings purge cron).
    '/((?!api/(?:health|livekit/webhook|calls/purge)$|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|apple-icon.png|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
