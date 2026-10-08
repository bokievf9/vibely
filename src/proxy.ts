import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip static assets, images, PWA files, metadata routes, the uptime health check and the
    // scheduled jobs (/api/cron/*) and server-to-server call routes (LiveKit webhook, recordings
    // purge, Telegram webhook), each authorized by its own secret.
    '/((?!api/(?:health|livekit/webhook|calls/purge|telegram/webhook)$|api/cron/|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|apple-icon.png|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
