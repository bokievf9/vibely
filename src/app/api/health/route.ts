import { connection } from 'next/server'
import { publicEnv } from '@/lib/env'

const SUPABASE_TIMEOUT_MS = 3000

// Uptime probe (.github/workflows/uptime.yml). Excluded from src/proxy.ts: no auth, no locale.
// 200 = app and Supabase reachable, 503 = app up but Supabase down. Never echoes URLs or keys.
export async function GET() {
  await connection()
  const supabase = await supabaseReachable()
  return Response.json(
    { ok: supabase, supabase: supabase ? 'ok' : 'unreachable' },
    { status: supabase ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}

// GoTrue's public health endpoint: cheap, no database query.
async function supabaseReachable(): Promise<boolean> {
  try {
    const res = await fetch(new URL('/auth/v1/health', publicEnv.NEXT_PUBLIC_SUPABASE_URL), {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}
