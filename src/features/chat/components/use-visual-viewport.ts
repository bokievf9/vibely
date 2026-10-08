'use client'

import { useEffect, type RefObject } from 'react'

const KEYBOARD_MIN_PX = 120

// Keeps a fixed full-screen element exactly on the visible area. iOS Safari does not resize the
// layout viewport for the software keyboard: it overlays the keyboard and scrolls the page, so a
// bottom-pinned composer ends up under the keys. The visual viewport is the truth there: size the
// element to its height and follow its offset. `data-keyboard` is set while the keyboard is open
// (the composer then drops its home-indicator padding). Android (interactive-widget=
// resizes-content) already shrinks the layout, so this is a no-op there apart from the attribute.
export function useVisualViewport(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    const vv = window.visualViewport
    if (!el || !vv) return
    const apply = () => {
      // Pinch zoom: let the page zoom normally instead of resizing the chat.
      if (vv.scale > 1.01) {
        el.style.height = ''
        el.style.transform = ''
        return
      }
      el.style.height = `${vv.height}px`
      el.style.transform = vv.offsetTop > 0 ? `translateY(${vv.offsetTop}px)` : ''
      el.toggleAttribute('data-keyboard', window.innerHeight - vv.height > KEYBOARD_MIN_PX)
    }
    apply()
    // Applied synchronously: these events fire at most once per frame, and a rAF would lag the
    // keyboard animation by a frame.
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      el.style.height = ''
      el.style.transform = ''
      el.removeAttribute('data-keyboard')
    }
  }, [ref])
}
