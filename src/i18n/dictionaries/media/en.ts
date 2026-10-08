// Voice messages and video circles in match chats. Kept apart from en.ts so the main dictionary
// stays small.
export const mediaEn = {
  voice: 'Voice message',
  video: 'Video message',
  previewVoice: '🎤 Voice message',
  previewVideo: '📹 Video message',
  previewExpired: 'Media expired',
  expired: {
    image: 'Photo expired',
    voice: 'Voice message expired',
    video: 'Video message expired',
  },
  expiredHint: 'Media is stored for 90 days',
  recordVoice: 'Record a voice message',
  recordVideo: 'Record a video message',
  holdHint: 'Hold to record, release to send. Tap to record hands-free.',
  slideCancel: 'Slide left to cancel',
  slideLock: 'Slide up to lock',
  recording: 'Recording',
  cancel: 'Cancel',
  send: 'Send',
  start: 'Start recording',
  stop: 'Stop recording',
  retake: 'Record again',
  sending: 'Sending…',
  play: 'Play',
  pause: 'Pause',
  speed: 'Playback speed',
  watch: 'Watch with sound',
  safetyNote:
    'Voice and video messages are stored for safety for up to 90 days. Moderators see them only when handling a report.',
  pushVoice: 'Sent you a voice message. Open Vibely to listen.',
  pushVideo: 'Sent you a video message. Open Vibely to watch.',
}

export type MediaDictionary = typeof mediaEn
