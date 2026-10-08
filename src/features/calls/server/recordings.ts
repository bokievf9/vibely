import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CallKind } from '../types'
import { getRecordingsEnv } from './env'
import { presignS3Url } from './s3-presign'

// Moderators get a link valid for 5 minutes, enough to start playback (CLAUDE.md: short TTL).
export const RECORDING_URL_TTL_S = 300

// calls/<match id>/<call id>.ogg (audio) or .mp4 (video); the same layout is checked in SQL.
export function recordingPath(matchId: string, callId: string, kind: CallKind) {
  return `calls/${matchId}/${callId}.${kind === 'audio' ? 'ogg' : 'mp4'}`
}

export async function signRecordingUrl(path: string): Promise<string> {
  const env = getRecordingsEnv()
  if (env.mode === 's3') {
    return presignS3Url({ ...env, method: 'GET', key: path, expiresIn: RECORDING_URL_TTL_S })
  }
  const { data, error } = await createAdminClient()
    .storage.from(env.bucket)
    .createSignedUrl(path, RECORDING_URL_TTL_S)
  if (error || !data) throw new Error(`recording: could not sign URL: ${error?.message}`)
  return data.signedUrl
}

// Deletes recording objects. A missing object counts as deleted (the lifecycle rule may have
// been first). Returns the paths that are gone.
export async function deleteRecordings(paths: string[]): Promise<string[]> {
  if (!paths.length) return []
  const env = getRecordingsEnv()
  if (env.mode === 'supabase') {
    const { error } = await createAdminClient().storage.from(env.bucket).remove(paths)
    if (error) throw new Error(`recording: could not delete: ${error.message}`)
    return paths
  }
  const results = await Promise.all(
    paths.map(async (path) => {
      const url = presignS3Url({ ...env, method: 'DELETE', key: path, expiresIn: 60 })
      const res = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(10_000) })
      if (res.ok || res.status === 404) return path
      console.error('[calls] delete failed', path, res.status)
      return null
    }),
  )
  return results.filter((p): p is string => p !== null)
}
