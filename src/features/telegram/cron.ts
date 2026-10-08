import 'server-only'
import { getCronSecret } from '@/lib/env.server'
import { isValidSecret } from './protocol'

export const NO_STORE = { 'Cache-Control': 'no-store' }

// Same contract as POST /api/cron/retention: `Authorization: Bearer <CRON_SECRET>`, compared in
// constant time. Returns the error response, or null when authorized.
export function rejectUnlessCron(request: Request): Response | null {
  const secret = getCronSecret()
  if (!secret) return Response.json({ ok: false }, { status: 503, headers: NO_STORE })
  const auth = request.headers.get('authorization') ?? ''
  if (!isValidSecret(auth, `Bearer ${secret}`)) {
    return Response.json({ ok: false }, { status: 401, headers: NO_STORE })
  }
  return null
}
