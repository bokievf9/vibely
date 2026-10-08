import 'server-only'
import {
  AccessToken,
  AudioCodec,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptions,
  RoomServiceClient,
  TrackSource,
  VideoCodec,
} from 'livekit-server-sdk'
import type { CallKind } from '../types'
import type { LiveKitEnv } from './env'

// Join tokens only need to live until the browser connects; LiveKit refreshes them for
// connected participants on its own.
const TOKEN_TTL_S = 120

export const roomName = (callId: string) => `call_${callId}`
const ROOM_RE = /^call_([0-9a-f-]{36})$/
export const callIdFromRoom = (name: string | undefined) =>
  (name && ROOM_RE.exec(name)?.[1]) || null

export function mintCallToken(
  env: LiveKitEnv,
  input: { callId: string; userId: string; name: string; kind: CallKind },
): Promise<string> {
  const token = new AccessToken(env.apiKey, env.apiSecret, {
    identity: input.userId,
    name: input.name,
    ttl: TOKEN_TTL_S,
  })
  token.addGrant({
    roomJoin: true,
    room: roomName(input.callId),
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    canPublishSources:
      input.kind === 'video'
        ? [TrackSource.MICROPHONE, TrackSource.CAMERA]
        : [TrackSource.MICROPHONE],
  })
  return token.toJwt()
}

// The room exists before anyone joins, so the egress can be started as soon as the callee answers.
// Only the two participants ever get a token for it (plus the hidden recorder).
// Rooms close 20 s after the last participant leaves (reconnect grace) or 60 s if nobody joins.
export async function createCallRoom(env: LiveKitEnv, callId: string) {
  await new RoomServiceClient(env.apiUrl, env.apiKey, env.apiSecret).createRoom({
    name: roomName(callId),
    emptyTimeout: 60,
    departureTimeout: 20,
  })
}

// Kicks everyone out; the egress then finalizes and uploads the file. Already-gone rooms are fine.
export async function closeCallRoom(env: LiveKitEnv, callId: string) {
  try {
    await new RoomServiceClient(env.apiUrl, env.apiKey, env.apiSecret).deleteRoom(roomName(callId))
  } catch (e) {
    console.warn('[calls] deleteRoom', callId, e instanceof Error ? e.message : e)
  }
}

// Compact on purpose (Supabase free tier, CLAUDE.md): ~15 MB/h for audio, ~350 MB/h for video.
const AUDIO_ONLY = new EncodingOptions({ audioCodec: AudioCodec.OPUS, audioBitrate: 32 })
const VIDEO = new EncodingOptions({
  width: 960,
  height: 540,
  framerate: 20,
  videoCodec: VideoCodec.H264_MAIN,
  videoBitrate: 700,
  keyFrameInterval: 4,
  audioCodec: AudioCodec.AAC,
  audioBitrate: 64,
})

// Room composite: one file with both sides mixed (grid layout for video). The upload target is
// the egress server's default storage (infra/livekit/egress.yaml), so no bucket keys travel here.
export async function startCallRecording(
  env: LiveKitEnv,
  input: { callId: string; kind: CallKind; path: string },
): Promise<string> {
  const output = new EncodedFileOutput({
    fileType: input.kind === 'audio' ? EncodedFileType.OGG : EncodedFileType.MP4,
    filepath: input.path,
    disableManifest: true,
  })
  const info = await new EgressClient(
    env.apiUrl,
    env.apiKey,
    env.apiSecret,
  ).startRoomCompositeEgress(
    roomName(input.callId),
    output,
    input.kind === 'audio'
      ? { audioOnly: true, encodingOptions: AUDIO_ONLY }
      : { layout: 'grid', encodingOptions: VIDEO },
  )
  return info.egressId
}

export async function stopCallRecording(env: LiveKitEnv, egressId: string) {
  try {
    await new EgressClient(env.apiUrl, env.apiKey, env.apiSecret).stopEgress(egressId)
  } catch (e) {
    console.warn('[calls] stopEgress', egressId, e instanceof Error ? e.message : e)
  }
}
