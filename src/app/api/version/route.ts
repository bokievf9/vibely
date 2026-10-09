import { connection } from 'next/server'
import { BUILD_ID } from '@/features/pwa/skew'

// The build this server runs. Open tabs compare it with their own id and reload after a deploy
// (src/features/pwa/components/version-watcher.tsx). Public, no auth, excluded from src/proxy.ts.
export async function GET() {
  await connection()
  return Response.json({ id: BUILD_ID }, { headers: { 'Cache-Control': 'no-store' } })
}
