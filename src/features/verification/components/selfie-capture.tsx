'use client'

import { useState, useTransition } from 'react'
import { Camera, RotateCcw, ScanFace } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { getBrowserClient } from '@/lib/supabase/client'
import type { ChallengeId } from '../challenges'
import { startVerification, submitVerification } from '../actions'
import { useCamera } from './use-camera'

type Step = 'intro' | 'live' | 'preview'

export function SelfieCapture({ userId }: { userId: string }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const { videoRef, start, stop, capture, error: cameraError } = useCamera()
  const [step, setStep] = useState<Step>('intro')
  const [challenge, setChallenge] = useState<ChallengeId>()
  const [shot, setShot] = useState<{ blob: Blob; url: string }>()
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()

  const begin = () =>
    startTransition(async () => {
      const result = await startVerification()
      if (!result.ok) return setError(result.error)
      setChallenge(result.data.challenge)
      setStep('live')
      if (!(await start())) setStep('intro')
    })

  const takeShot = async () => {
    const blob = await capture()
    if (!blob) return
    stop()
    setShot({ blob, url: URL.createObjectURL(blob) })
    setStep('preview')
  }

  const retake = async () => {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(undefined)
    setStep('live')
    await start()
  }

  const send = () =>
    startTransition(async () => {
      if (!shot) return
      setError(undefined)
      const path = `${userId}/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await getBrowserClient()
        .storage.from('selfies')
        .upload(path, shot.blob, { contentType: 'image/jpeg' })
      if (uploadError) return setError('selfieFailed')
      const result = await submitVerification({ path })
      if (!result.ok) return setError(result.error)
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-5">
      {challenge && step !== 'intro' && (
        <p className="bg-accent/15 text-accent rounded-2xl px-4 py-3 text-center font-medium">
          {dict.verification.challenges[challenge]}
        </p>
      )}

      <div className="bg-surface relative aspect-[3/4] overflow-hidden rounded-3xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={step === 'live' ? 'size-full -scale-x-100 object-cover' : 'hidden'}
        />
        {step === 'preview' && shot && (
          // Local blob preview: next/image can't optimize object URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.url}
            alt={dict.verification.selfieAlt}
            width={1080}
            height={1440}
            className="size-full object-cover"
          />
        )}
        {step === 'intro' && (
          <div className="text-muted flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
            <ScanFace className="size-16" />
            <p>{dict.verification.intro}</p>
          </div>
        )}
      </div>

      <FormError message={errorText(error ?? cameraError)} />

      {step === 'intro' && (
        <Button onClick={begin} loading={pending} fullWidth>
          <Camera className="size-5" /> {dict.verification.start}
        </Button>
      )}
      {step === 'live' && (
        <Button onClick={takeShot} fullWidth>
          <Camera className="size-5" /> {dict.verification.capture}
        </Button>
      )}
      {step === 'preview' && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={retake} disabled={pending}>
            <RotateCcw className="size-5" /> {dict.verification.retake}
          </Button>
          <Button onClick={send} loading={pending}>
            {dict.common.send}
          </Button>
        </div>
      )}
    </div>
  )
}
