import { createHash, timingSafeEqual } from 'node:crypto'
import { getCronSecret } from '@/lib/env.server'
import { runRetention } from '@/features/retention/purge'

const NO_STORE = { 'Cache-Control': 'no-store' }

// Constant-time comparison (hashing first makes the lengths equal).
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

// Daily retention job (.github/workflows/retention.yml): `Authorization: Bearer <CRON_SECRET>`.
// Excluded from src/proxy.ts (no session, no locale). Responds with counts only, never paths.
export async function POST(request: Request) {
  const secret = getCronSecret()
  if (!secret) return Response.json({ ok: false }, { status: 503, headers: NO_STORE })
  const auth = request.headers.get('authorization') ?? ''
  if (!sameSecret(auth, `Bearer ${secret}`)) {
    return Response.json({ ok: false }, { status: 401, headers: NO_STORE })
  }
  try {
    const report = await runRetention()
    console.info('[retention]', report)
    return Response.json({ ok: true, ...report }, { headers: NO_STORE })
  } catch (e) {
    console.error('[retention]', e instanceof Error ? e.message : e)
    return Response.json({ ok: false }, { status: 500, headers: NO_STORE })
  }
}
