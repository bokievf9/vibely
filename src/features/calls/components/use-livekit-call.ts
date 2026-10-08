'use client'

import { useEffect, useRef, useState } from 'react'
import type { LocalVideoTrack, RemoteTrack, Room } from 'livekit-client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import type { CallSession } from '../types'

export type LinkState = 'connecting' | 'connected' | 'reconnecting'
type Facing = 'user' | 'environment'

// One LiveKit room for the lifetime of the call screen. livekit-client is loaded on demand, so it
// never weighs on pages without a call. Remote audio plays through hidden <audio> elements;
// iOS Safari may block playback until a tap (needsAudio → unlockAudio()).
export function useLiveKitCall(session: CallSession, onLost: () => void) {
  const roomRef = useRef<Room | null>(null)
  const lost = useRef(onLost)
  useEffect(() => {
    lost.current = onLost
  })
  const [link, setLink] = useState<LinkState>('connecting')
  const [partnerJoined, setPartnerJoined] = useState(false)
  const [remoteVideo, setRemoteVideo] = useState<RemoteTrack | null>(null)
  const [localVideo, setLocalVideo] = useState<LocalVideoTrack | null>(null)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(session.kind === 'video')
  const [facing, setFacing] = useState<Facing>('user')
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [needsAudio, setNeedsAudio] = useState(false)
  const [error, setError] = useState<ErrorKey>()

  useEffect(() => {
    let cancelled = false
    let room: Room | null = null
    const audioBox = document.createElement('div')
    audioBox.hidden = true
    document.body.appendChild(audioBox)
    void (async () => {
      const lk = await import('livekit-client')
      if (cancelled) return
      const { RoomEvent, Track } = lk
      const r = new lk.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        videoCaptureDefaults: { resolution: lk.VideoPresets.h540.resolution, facingMode: 'user' },
      })
      room = r
      roomRef.current = r
      const camera = () =>
        r.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null
      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) audioBox.appendChild(track.attach())
        if (track.kind === Track.Kind.Video) setRemoteVideo(track)
      })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove())
          if (track.kind === Track.Kind.Video) setRemoteVideo(null)
        })
        .on(RoomEvent.ParticipantConnected, () => setPartnerJoined(true))
        .on(RoomEvent.Reconnecting, () => setLink('reconnecting'))
        .on(RoomEvent.Reconnected, () => setLink('connected'))
        .on(RoomEvent.Disconnected, () => lost.current())
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!r.canPlaybackAudio))
        .on(RoomEvent.LocalTrackPublished, () => setLocalVideo(camera()))
        .on(RoomEvent.LocalTrackUnpublished, () => setLocalVideo(camera()))

      try {
        await r.connect(session.url, session.token)
      } catch (e) {
        console.error('[calls] connect', e)
        if (!cancelled) lost.current()
        return
      }
      if (cancelled) return
      setLink('connected')
      setPartnerJoined(r.remoteParticipants.size > 0)
      setNeedsAudio(!r.canPlaybackAudio)
      try {
        await r.localParticipant.setMicrophoneEnabled(true)
      } catch {
        setMic(false)
        setError('callMicDenied')
      }
      if (session.kind === 'video') {
        try {
          await r.localParticipant.setCameraEnabled(true)
        } catch {
          setCam(false)
          setError('callCameraDenied')
        }
      }
      // Choosing the output only works where the browser supports setSinkId (not iOS Safari).
      const devices = await lk.Room.getLocalDevices('audiooutput', false).catch(() => [])
      if (!cancelled && 'setSinkId' in HTMLMediaElement.prototype) setOutputs(devices)
    })()
    return () => {
      cancelled = true
      roomRef.current = null
      room?.removeAllListeners()
      void room?.disconnect()
      audioBox.remove()
    }
  }, [session.url, session.token, session.kind])

  const run = (fn: (room: Room) => Promise<unknown>, onError?: ErrorKey) => {
    const room = roomRef.current
    if (!room) return
    fn(room).catch(() => onError && setError(onError))
  }

  return {
    link,
    partnerJoined,
    remoteVideo,
    localVideo,
    mic,
    cam,
    facing,
    canSwitchOutput: outputs.length > 1,
    needsAudio,
    error,
    toggleMic: () =>
      run(async (r) => {
        await r.localParticipant.setMicrophoneEnabled(!mic)
        setMic(!mic)
      }, 'callMicDenied'),
    toggleCam: () =>
      run(async (r) => {
        await r.localParticipant.setCameraEnabled(!cam, { facingMode: facing })
        setCam(!cam)
      }, 'callCameraDenied'),
    switchCamera: () =>
      run(async () => {
        const next: Facing = facing === 'user' ? 'environment' : 'user'
        await localVideo?.restartTrack({ facingMode: next })
        setFacing(next)
      }),
    switchOutput: () =>
      run(async (r) => {
        const current = r.getActiveDevice('audiooutput')
        const i = outputs.findIndex((d) => d.deviceId === current)
        const next = outputs[(i + 1) % outputs.length]
        if (next) await r.switchActiveDevice('audiooutput', next.deviceId)
      }),
    unlockAudio: () =>
      run(async (r) => {
        await r.startAudio()
        setNeedsAudio(!r.canPlaybackAudio)
      }),
  }
}
