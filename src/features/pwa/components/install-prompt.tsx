'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/client'
import { isIos, isStandalone, readFlag, writeFlag } from '../platform'

const DISMISSED_KEY = 'vibely_install_dismissed'

// Chrome/Android only; not in the TypeScript DOM lib.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Mode = { kind: 'native'; event: BeforeInstallPromptEvent } | { kind: 'ios' } | null

// "Install Vibely" banner above the bottom nav. iOS has no install API (and Web Push there needs
// the installed app), so it shows the Share → Add to Home Screen steps instead.
export function InstallPrompt() {
  const { dict } = useI18n()
  const [mode, setMode] = useState<Mode>(null)

  useEffect(() => {
    if (isStandalone() || readFlag(DISMISSED_KEY)) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setMode({ kind: 'native', event: e as BeforeInstallPromptEvent })
    }
    const onInstalled = () => setMode(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    // Let the page settle before showing the iOS hint.
    const timer = isIos() ? window.setTimeout(() => setMode({ kind: 'ios' }), 1500) : undefined
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    writeFlag(DISMISSED_KEY)
    setMode(null)
  }

  const install = async () => {
    if (mode?.kind !== 'native') return
    await mode.event.prompt()
    const { outcome } = await mode.event.userChoice
    if (outcome === 'dismissed') writeFlag(DISMISSED_KEY)
    setMode(null)
  }

  return (
    <AnimatePresence>
      {mode && (
        <motion.aside
          aria-label={dict.pwa.installTitle}
          className="bg-surface border-border fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl border p-4 shadow-lg"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
        >
          <Download className="text-accent mt-0.5 size-6 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-semibold">{dict.pwa.installTitle}</p>
            <p className="text-muted text-sm">{dict.pwa.installText}</p>
            {mode.kind === 'ios' ? (
              <p className="flex items-center gap-1.5 text-sm">
                <Share className="size-4 shrink-0" aria-hidden /> {dict.pwa.iosSteps}
              </p>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void install()}>
                  {dict.pwa.install}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  {dict.pwa.later}
                </Button>
              </div>
            )}
          </div>
          <button type="button" onClick={dismiss} aria-label={dict.common.close} className="p-1">
            <X className="size-5" aria-hidden />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
