// Version skew: a tab or installed PWA opened before a deploy keeps running the old JavaScript.
// Its Server Action ids and lazy chunks no longer exist on the server, so it must reload itself.
// Pure helpers (no DOM access) so they can be unit tested.

// The id of the build this code belongs to, inlined at build time (next.config.ts `env`).
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

// At most one automatic reload per minute per tab, so a persistent mismatch can never loop.
export const RELOAD_GUARD_MS = 60_000
export const RELOAD_GUARD_KEY = 'vibely:skew-reload-at'

const SKEW_PATTERNS = [
  // Next 16 client (UnrecognizedActionError).
  /Server Action ".*" was not found on the server/i,
  // Server log wording, in case it reaches the client.
  /Failed to find Server Action/i,
  /older or newer deployment/i,
  // fetchServerAction got HTML or plain text instead of an RSC payload.
  /An unexpected response was received from the server/i,
  // A lazy chunk of the old build was removed by the deploy (Turbopack and webpack wordings).
  /Failed to load chunk/i,
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/,
]

export function isVersionSkewMessage(message: unknown): boolean {
  return typeof message === 'string' && SKEW_PATTERNS.some((re) => re.test(message))
}

// Accepts whatever a rejected promise or an error event carries.
export function isVersionSkewError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'string') return isVersionSkewMessage(error)
  if (typeof error !== 'object') return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  return (
    name === 'UnrecognizedActionError' || name === 'ChunkLoadError' || isVersionSkewMessage(message)
  )
}

// The server runs another build (its id comes from /api/version). Empty or odd ids never count.
export function isOtherBuild(serverId: unknown, clientId: string = BUILD_ID): boolean {
  return typeof serverId === 'string' && serverId.length > 0 && serverId !== clientId
}

// True when the last automatic reload is old enough to allow another one.
export function canReloadAgain(lastReloadAt: number | null, now: number): boolean {
  if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true
  return now - lastReloadAt >= RELOAD_GUARD_MS || now < lastReloadAt
}
