import 'server-only'
import { z } from 'zod'

// Calls are optional: the whole feature (buttons, routes, admin player) stays hidden unless the
// three LiveKit values are set. Validated lazily, so the site builds and runs without them.
const liveKitSchema = z.object({
  url: z.url({ protocol: /^wss?$/ }),
  apiKey: z.string().trim().min(3),
  apiSecret: z.string().trim().min(32),
})

export type LiveKitEnv = z.infer<typeof liveKitSchema> & { apiUrl: string }
let liveKitCached: LiveKitEnv | null | undefined

export function getLiveKitEnv(): LiveKitEnv | null {
  if (liveKitCached !== undefined) return liveKitCached
  const parsed = liveKitSchema.safeParse({
    url: process.env.LIVEKIT_URL || undefined,
    apiKey: process.env.LIVEKIT_API_KEY || undefined,
    apiSecret: process.env.LIVEKIT_API_SECRET || undefined,
  })
  if (!parsed.success && process.env.LIVEKIT_URL) {
    console.error('[calls] LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET invalid: calls disabled')
  }
  // The server API lives on the same host as the signalling WebSocket.
  liveKitCached = parsed.success
    ? { ...parsed.data, apiUrl: parsed.data.url.replace(/^ws/, 'http') }
    : null
  return liveKitCached
}

export const callsEnabled = () => getLiveKitEnv() !== null

// Where recordings live. "s3": any S3-compatible bucket (DigitalOcean Spaces), all five values
// set. Otherwise "supabase": the private call-recordings bucket of the Supabase project (the
// egress uploads through Supabase's S3 endpoint). See docs/calls.md.
const s3Schema = z.object({
  endpoint: z.url({ protocol: /^https$/ }),
  region: z.string().trim().min(1),
  bucket: z.string().trim().min(3),
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  pathStyle: z.boolean(),
})

export type RecordingsEnv =
  ({ mode: 's3' } & z.infer<typeof s3Schema>) | { mode: 'supabase'; bucket: string }

export const SUPABASE_RECORDINGS_BUCKET = 'call-recordings'
let recordingsCached: RecordingsEnv | undefined

export function getRecordingsEnv(): RecordingsEnv {
  if (recordingsCached) return recordingsCached
  const s3 = s3Schema.safeParse({
    endpoint: process.env.RECORDINGS_S3_ENDPOINT || undefined,
    region: process.env.RECORDINGS_S3_REGION || undefined,
    bucket: process.env.RECORDINGS_S3_BUCKET || undefined,
    accessKeyId: process.env.RECORDINGS_S3_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.RECORDINGS_S3_SECRET_ACCESS_KEY || undefined,
    pathStyle: process.env.RECORDINGS_S3_FORCE_PATH_STYLE === 'true',
  })
  recordingsCached = s3.success
    ? { mode: 's3', ...s3.data }
    : { mode: 'supabase', bucket: SUPABASE_RECORDINGS_BUCKET }
  return recordingsCached
}

// Bearer secret of POST /api/calls/purge (daily cron). Unset = the route answers 404.
export function getPurgeSecret(): string | null {
  const value = process.env.CALLS_PURGE_SECRET?.trim()
  return value && value.length >= 32 ? value : null
}
