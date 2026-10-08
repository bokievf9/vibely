'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
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

// Compact "Install Vibely" card floating above the tab bar. iOS has no install API (and Web Push
// there needs the installed app), so it shows the Share, Add to Home Screen steps instead.
// While visible it publishes its height as --install-prompt-h; globals.css adds that to the page's
// bottom padding so the card never covers the last row. Immersive screens hide it (globals.css).
// Only on scrolling list screens, where the page gets extra bottom padding for it. On Discover,
// profiles and editors it would sit on top of the main actions.
const LIST_SCREENS = /^\/[a-z]{2}\/(feed|chats)\/?$/

export function InstallPrompt() {
  const { dict } = useI18n()
  const [found, setMode] = useState<Mode>(null)
  const pathname = usePathname()
  const mode = pathname && LIST_SCREENS.test(pathname) ? found : null

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
        <Card key="install" kind={mode.kind} onInstall={() => void install()} onDismiss={dismiss}>
          <p className="truncate text-sm font-semibold">{dict.pwa.installTitle}</p>
          {mode.kind === 'ios' ? (
            <p className="text-muted flex items-start gap-1 text-[13px] leading-snug">
              <Share className="mt-px size-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">{dict.pwa.iosSteps}</span>
            </p>
          ) : (
            <p className="text-muted line-clamp-2 text-[13px] leading-snug">
              {dict.pwa.installText}
            </p>
          )}
        </Card>
      )}
    </AnimatePresence>
  )
}

function Card({
  kind,
  onInstall,
  onDismiss,
  children,
}: {
  kind: 'native' | 'ios'
  onInstall: () => void
  onDismiss: () => void
  children: ReactNode
}) {
  const { dict } = useI18n()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--install-prompt-h', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--install-prompt-h')
    }
  }, [])

  return (
    <motion.aside
      ref={ref}
      aria-label={dict.pwa.installTitle}
      data-install-prompt
      className="bg-surface/95 fixed inset-x-3 bottom-[calc(var(--tabbar-h)+0.5rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl py-2 pr-1 pl-3 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] ring-1 ring-white/[0.07] backdrop-blur-xl"
      initial={{ opacity: 0, transform: 'translateY(16px) scale(0.98)' }}
      animate={{
        opacity: 1,
        transform: 'translateY(0px) scale(1)',
        transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1] },
      }}
      exit={{
        opacity: 0,
        transform: 'translateY(16px) scale(0.98)',
        transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
      }}
    >
      <span className="bg-accent/15 text-accent flex size-10 shrink-0 items-center justify-center rounded-2xl">
        <Download className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      {kind === 'native' && (
        <Button size="sm" onClick={onInstall} className="shrink-0">
          {dict.pwa.install}
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dict.common.close}
        className="text-muted active:bg-border flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,scale] duration-150 ease-out active:scale-[0.92]"
      >
        <X className="size-5" aria-hidden />
      </button>
    </motion.aside>
  )
}
