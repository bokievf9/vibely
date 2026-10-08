'use client'

import Script from 'next/script'
import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react'

// Cloudflare Turnstile (anti SMS-pumping). Explicit rendering, so it also works after a
// client-side navigation when the script is already loaded. Supabase Auth verifies the token
// (Dashboard → Authentication → Bot and Abuse Protection, with the Turnstile secret key).

type TurnstileOptions = {
  sitekey: string
  action?: string
  appearance?: 'always' | 'execute' | 'interaction-only'
  size?: 'normal' | 'flexible' | 'compact'
  theme?: 'auto' | 'light' | 'dark'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string | undefined
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export type TurnstileHandle = { reset: () => void }

type Props = {
  siteKey: string
  action: string
  onToken: (token: string) => void
  ref?: Ref<TurnstileHandle>
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function Turnstile({ siteKey, action, onToken, ref }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const onTokenRef = useRef(onToken)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  const mount = useCallback(() => {
    if (!container.current || !window.turnstile || widgetId.current) return
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      appearance: 'interaction-only',
      size: 'flexible',
      theme: 'dark',
      callback: (token) => onTokenRef.current(token),
      'expired-callback': () => onTokenRef.current(''),
      'error-callback': () => onTokenRef.current(''),
    })
  }, [siteKey, action])

  useEffect(() => {
    mount()
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = undefined
    }
  }, [mount])

  // Tokens are single-use: get a fresh one after every request that consumed it.
  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current('')
      if (widgetId.current) window.turnstile?.reset(widgetId.current)
    },
  }))

  return (
    <>
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={mount} />
      <div ref={container} className="empty:hidden" />
    </>
  )
}
