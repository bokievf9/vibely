import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip static assets, images, PWA files, metadata routes, the uptime health check, the build
    // id (/api/version, read by open tabs to detect a deploy), the scheduled jobs (/api/cron/*)
    // and server-to-server call routes (LiveKit webhook, recordings purge, Telegram webhook,
    // payment gateway webhooks /api/payments/webhook/*),
    // each authorized by its own secret. Also the landing media (/landing/*: screenshots,
    // promo video) and /llms.txt.
    '/((?!api/(?:health|version|livekit/webhook|calls/purge|telegram/webhook)$|api/cron/|api/payments/webhook/|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|landing/|apple-icon.png|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
