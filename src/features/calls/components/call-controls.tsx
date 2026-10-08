'use client'

import type { ReactNode } from 'react'
import { Mic, MicOff, PhoneOff, SwitchCamera, Video, VideoOff, Volume2 } from 'lucide-react'
import { useI18n } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { CallKind } from '../types'
import type { useLiveKitCall } from './use-livekit-call'

type Call = ReturnType<typeof useLiveKitCall>

function RoundButton(props: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.active}
      onClick={props.onClick}
      className={cn(
        'flex size-14 items-center justify-center rounded-full text-white transition active:scale-95',
        props.danger ? 'bg-red-600' : props.active ? 'bg-white text-black' : 'bg-white/15',
      )}
    >
      {props.children}
    </button>
  )
}

export function CallControls({
  call,
  kind,
  onHangUp,
}: {
  call: Call
  kind: CallKind
  onHangUp: () => void
}) {
  const { dict } = useI18n()
  const t = dict.calls
  return (
    <div className="flex items-center justify-center gap-4">
      <RoundButton label={call.mic ? t.mute : t.unmute} active={!call.mic} onClick={call.toggleMic}>
        {call.mic ? <Mic className="size-6" /> : <MicOff className="size-6" />}
      </RoundButton>
      {kind === 'video' && (
        <RoundButton
          label={call.cam ? t.cameraOff : t.cameraOn}
          active={!call.cam}
          onClick={call.toggleCam}
        >
          {call.cam ? <Video className="size-6" /> : <VideoOff className="size-6" />}
        </RoundButton>
      )}
      {kind === 'video' && call.cam && (
        <RoundButton label={t.switchCamera} onClick={call.switchCamera}>
          <SwitchCamera className="size-6" />
        </RoundButton>
      )}
      {call.canSwitchOutput && (
        <RoundButton label={t.speaker} onClick={call.switchOutput}>
          <Volume2 className="size-6" />
        </RoundButton>
      )}
      <RoundButton label={t.end} danger onClick={onHangUp}>
        <PhoneOff className="size-6" />
      </RoundButton>
    </div>
  )
}
