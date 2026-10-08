import { getViewer, nextStepFor } from '@/features/auth/session'
import { callsEnabled } from '../server/env'
import { CallLayer } from './call-layer'

// Mounts the call layer only when calls are configured (LIVEKIT_*) and the viewer is a verified
// user. Reads cookies: render inside <Suspense>.
export async function CallLayerGate() {
  const viewer = await getViewer()
  if (!viewer || nextStepFor(viewer) !== '/swipe' || !callsEnabled()) return null
  return <CallLayer viewerId={viewer.id} />
}
