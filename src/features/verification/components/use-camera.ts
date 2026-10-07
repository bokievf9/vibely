'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorKey } from '@/i18n/dictionaries/en'

// Front camera stream for a live selfie. Gallery uploads are intentionally not supported.
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<ErrorKey>()

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setError(undefined)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      return true
    } catch {
      setError('cameraDenied')
      return false
    }
  }, [])

  // Grabs the current frame as JPEG. Unlike the on-screen preview, the photo is not mirrored.
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    if (!video?.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  }, [])

  useEffect(() => stop, [stop])

  return { videoRef, start, stop, capture, error }
}
