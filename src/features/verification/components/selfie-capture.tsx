'use client'

import { useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, RotateCcw, ScanFace, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { useErrorText, useI18n, useLocaleRouter } from '@/i18n/client'
import type { ErrorKey } from '@/i18n/dictionaries/en'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import { getBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { ChallengeId } from '../challenges'
import { startVerification, submitVerification } from '../actions'
import { useCamera } from './use-camera'

type Step = 'intro' | 'live' | 'preview'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } },
}

export function SelfieCapture({ userId }: { userId: string }) {
  const { dict } = useI18n()
  const errorText = useErrorText()
  const router = useLocaleRouter()
  const { videoRef, start, stop, capture, error: cameraError } = useCamera()
  const [step, setStep] = useState<Step>('intro')
  const [ready, setReady] = useState(false)
  const [challenge, setChallenge] = useState<ChallengeId>()
  const [shot, setShot] = useState<{ blob: Blob; url: string }>()
  const [error, setError] = useState<ErrorKey>()
  const [pending, startTransition] = useTransition()
  const flashRef = useRef<HTMLDivElement>(null)

  const begin = () =>
    startTransition(async () => {
      const result = await startVerification()
      if (!result.ok) return setError(result.error)
      setChallenge(result.data.challenge)
      setReady(false)
      setStep('live')
      if (!(await start())) setStep('intro')
    })

  const takeShot = async () => {
    if (!ready) return
    // Shutter feedback: a white flash over the frame and a short buzz (Android).
    haptic('medium')
    flashRef.current?.animate([{ opacity: 0.85 }, { opacity: 0 }], {
      duration: 320,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    })
    const blob = await capture()
    if (!blob) return
    stop()
    setShot({ blob, url: URL.createObjectURL(blob) })
    setStep('preview')
  }

  const retake = async () => {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(undefined)
    setReady(false)
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
      track('selfie_submitted')
      haptic('success')
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-5">
      <AnimatePresence initial={false}>
        {challenge && step !== 'intro' && (
          <motion.p
            {...fade}
            className="bg-accent/15 text-accent rounded-2xl px-4 py-3 text-center font-medium text-balance"
          >
            {dict.verification.challenges[challenge]}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="bg-surface relative aspect-[3/4] overflow-hidden rounded-3xl">
        {/* Always mounted: the camera stream is attached to this element. */}
        <video
          ref={videoRef}
          playsInline
          muted
          onPlaying={() => setReady(true)}
          className={cn(
            'absolute inset-0 size-full -scale-x-100 object-cover transition-opacity duration-200',
            step === 'live' && ready ? 'opacity-100' : 'opacity-0',
          )}
        />
        <AnimatePresence initial={false}>
          {step === 'live' && (
            <motion.div key="guide" {...fade} className="pointer-events-none absolute inset-0">
              {/* Face oval: everything outside it is dimmed, so the eye goes to the cut-out. */}
              <div className="absolute top-[44%] left-1/2 h-[62%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/80 shadow-[0_0_0_100vmax_rgb(11_11_16/0.55)]" />
              <p className="absolute inset-x-4 bottom-4 text-center text-sm font-medium text-white">
                {dict.flows.selfie.fitFace}
              </p>
            </motion.div>
          )}
          {step === 'preview' && shot && (
            // Local blob preview: next/image can't optimize object URLs.
            <motion.img
              key="preview"
              {...fade}
              src={shot.url}
              alt={dict.verification.selfieAlt}
              width={1080}
              height={1440}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {step === 'intro' && (
            <motion.div
              key="intro"
              {...fade}
              className="text-muted absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <ScanFace className="size-16" aria-hidden />
              <p className="text-pretty">{dict.verification.intro}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-white opacity-0" />
      </div>

      <FormError message={errorText(error ?? cameraError)} />

      {/* Fixed-height slot: switching between the button, the shutter and the pair below does
          not move anything under it. */}
      <div className="flex min-h-[4.5rem] items-center">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'intro' && (
            <motion.div key="intro" {...fade} className="w-full">
              <Button onClick={begin} loading={pending} fullWidth>
                <Camera className="size-5" /> {dict.verification.start}
              </Button>
            </motion.div>
          )}
          {step === 'live' && (
            <motion.div key="live" {...fade} className="flex w-full justify-center">
              <button
                type="button"
                onClick={() => void takeShot()}
                disabled={!ready}
                aria-label={dict.verification.capture}
                className="group flex size-[72px] items-center justify-center rounded-full border-4 border-white/90 transition-opacity disabled:opacity-40"
              >
                <span className="size-[52px] rounded-full bg-white transition-transform duration-150 ease-out group-active:scale-[0.88]" />
              </button>
            </motion.div>
          )}
          {step === 'preview' && (
            <motion.div key="preview" {...fade} className="grid w-full grid-cols-2 gap-3">
              <Button variant="secondary" onClick={retake} disabled={pending}>
                <RotateCcw className="size-5" /> {dict.verification.retake}
              </Button>
              <Button onClick={send} loading={pending}>
                <SendHorizontal className="size-5" /> {dict.common.send}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
