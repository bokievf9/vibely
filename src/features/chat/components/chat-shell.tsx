'use client'

import { useRef, type ReactNode } from 'react'
import { CHAT_SHELL_CLASS } from './chat-layout'
import { useVisualViewport } from './use-visual-viewport'
import { Immersive } from '@/components/layout/immersive'

// Immersive chat room frame: hides the tab bar ([data-immersive]) and follows the visual viewport
// so the composer always sits right above the keyboard.
export function ChatShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useVisualViewport(ref)
  return (
    <div ref={ref} data-immersive className={CHAT_SHELL_CLASS}>
      <Immersive />
      {children}
    </div>
  )
}
